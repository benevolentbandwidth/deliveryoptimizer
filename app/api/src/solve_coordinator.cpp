#include "deliveryoptimizer/api/solve_coordinator.hpp"

#include <algorithm>
#include <chrono>
#include <utility>

namespace {

[[nodiscard]] deliveryoptimizer::api::CoordinatedSolveResult
ToCoordinatedSolveResult(const deliveryoptimizer::api::VroomRunResult& result) {
  switch (result.status) {
  case deliveryoptimizer::api::VroomRunStatus::kSuccess:
    return deliveryoptimizer::api::CoordinatedSolveResult{
        .status = deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded,
        .output = result.output,
    };
  case deliveryoptimizer::api::VroomRunStatus::kTimedOut:
    return deliveryoptimizer::api::CoordinatedSolveResult{
        .status = deliveryoptimizer::api::CoordinatedSolveStatus::kTimedOut,
        .output = std::nullopt,
    };
  case deliveryoptimizer::api::VroomRunStatus::kFailed:
    break;
  }

  return deliveryoptimizer::api::CoordinatedSolveResult{
      .status = deliveryoptimizer::api::CoordinatedSolveStatus::kFailed,
      .output = std::nullopt,
  };
}

[[nodiscard]] bool HasQueueWaitExpired(const std::chrono::steady_clock::time_point deadline) {
  return std::chrono::steady_clock::now() >= deadline;
}

[[nodiscard]] std::chrono::steady_clock::time_point
BuildQueueDeadline(const std::chrono::milliseconds queue_wait) {
  const auto now = std::chrono::steady_clock::now();
  const auto remaining_until_max = std::chrono::steady_clock::time_point::max() - now;
  const auto remaining_ms =
      std::chrono::duration_cast<std::chrono::milliseconds>(remaining_until_max);
  if (queue_wait > remaining_ms) {
    return std::chrono::steady_clock::time_point::max();
  }

  return now + queue_wait;
}

[[nodiscard]] std::size_t
ResolveCompletionWorkerCount(const deliveryoptimizer::api::SolveAdmissionConfig& config,
                             const deliveryoptimizer::api::SolveCoordinatorOptions& options) {
  return std::max<std::size_t>(1U,
                               options.completion_worker_count.value_or(config.max_concurrency));
}

} // namespace

namespace deliveryoptimizer::api {

SolveCoordinator::SolveCoordinator(SolveAdmissionConfig config,
                                   std::shared_ptr<const VroomRunner> runner,
                                   SolveCoordinatorOptions options)
    : config_(config), options_(options), runner_(std::move(runner)) {
  const std::size_t completion_worker_count = ResolveCompletionWorkerCount(config_, options_);
  completion_workers_.reserve(completion_worker_count);
  for (std::size_t index = 0U; index < completion_worker_count; ++index) {
    completion_workers_.emplace_back([this] { CompletionLoop(); });
  }

  workers_.reserve(config_.max_concurrency);
  for (std::size_t index = 0U; index < config_.max_concurrency; ++index) {
    workers_.emplace_back([this] { WorkerLoop(); });
  }
  if (options_.enable_queue_timer) {
    queue_timer_ = std::jthread([this] { QueueTimerLoop(); });
  }
}

SolveCoordinator::~SolveCoordinator() {
  std::deque<QueuedSolveRequest> drained_queue;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    shutting_down_ = true;
    drained_queue = std::move(queue_);
  }
  condition_.notify_all();

  for (auto& queued_request : drained_queue) {
    EnqueueCompletion([callback = std::move(queued_request.callback)]() mutable {
      callback(CoordinatedSolveResult{
          .status = CoordinatedSolveStatus::kFailed,
          .output = std::nullopt,
      });
    });
  }

  queue_timer_ = std::jthread{};
  workers_.clear();

  {
    std::lock_guard<std::mutex> lock(completion_mutex_);
    completion_shutting_down_ = true;
  }
  completion_condition_.notify_all();
  completion_workers_.clear();
}

SolveAdmissionStatus SolveCoordinator::Submit(const SolveRequestSize& request_size,
                                              PayloadFactory payload_factory,
                                              CompletionCallback callback) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (shutting_down_) {
    return SolveAdmissionStatus::kRejectedQueueFull;
  }

  const SolveAdmissionStatus admission_status =
      EvaluateSolveAdmission(config_, request_size, active_solves_, queue_.size());
  if (admission_status != SolveAdmissionStatus::kAccepted) {
    return admission_status;
  }

  queue_.push_back(QueuedSolveRequest{
      .sequence_number = next_sequence_number_++,
      .payload_factory = std::move(payload_factory),
      .callback = std::move(callback),
      .deadline = BuildQueueDeadline(config_.max_queue_wait),
  });
  condition_.notify_all();
  return SolveAdmissionStatus::kAccepted;
}

void SolveCoordinator::EnqueueCompletion(CompletionTask task) {
  {
    std::lock_guard<std::mutex> lock(completion_mutex_);
    completion_queue_.push_back(std::move(task));
  }
  completion_condition_.notify_one();
}

void SolveCoordinator::WorkerLoop() {
  while (true) {
    std::optional<QueuedSolveRequest> queued_request;
    bool queue_wait_expired = false;
    {
      std::unique_lock<std::mutex> lock(mutex_);
      condition_.wait(lock, [this] { return shutting_down_ || !queue_.empty(); });
      if (shutting_down_ && queue_.empty()) {
        return;
      }

      queued_request = std::move(queue_.front());
      queue_.pop_front();
      queue_wait_expired = HasQueueWaitExpired(queued_request->deadline);
      if (!queue_wait_expired) {
        ++active_solves_;
      }
    }
    condition_.notify_all();

    if (queue_wait_expired) {
      EnqueueCompletion([callback = std::move(queued_request->callback)]() mutable {
        callback(CoordinatedSolveResult{
            .status = CoordinatedSolveStatus::kQueueWaitTimedOut,
            .output = std::nullopt,
        });
      });
      continue;
    }

    const VroomRunResult solve_result = runner_->Run(queued_request->payload_factory());
    {
      std::lock_guard<std::mutex> lock(mutex_);
      --active_solves_;
    }
    condition_.notify_all();

    CoordinatedSolveResult coordinated_result = ToCoordinatedSolveResult(solve_result);
    EnqueueCompletion(
        [callback = std::move(queued_request->callback),
         result = std::move(coordinated_result)]() mutable { callback(std::move(result)); });
  }
}

void SolveCoordinator::QueueTimerLoop() {
  while (true) {
    std::optional<QueuedSolveRequest> expired_request;
    {
      std::unique_lock<std::mutex> lock(mutex_);
      condition_.wait(lock, [this] { return shutting_down_ || !queue_.empty(); });
      if (shutting_down_ && queue_.empty()) {
        return;
      }

      const std::uint64_t front_sequence_number = queue_.front().sequence_number;
      const auto front_deadline = queue_.front().deadline;
      const bool queue_changed =
          condition_.wait_until(lock, front_deadline, [this, front_sequence_number] {
            return shutting_down_ || queue_.empty() ||
                   queue_.front().sequence_number != front_sequence_number;
          });
      if (queue_changed) {
        if (shutting_down_ && queue_.empty()) {
          return;
        }
        continue;
      }

      if (queue_.empty() || !HasQueueWaitExpired(queue_.front().deadline)) {
        continue;
      }

      expired_request = std::move(queue_.front());
      queue_.pop_front();
    }
    condition_.notify_all();

    EnqueueCompletion([callback = std::move(expired_request->callback)]() mutable {
      callback(CoordinatedSolveResult{
          .status = CoordinatedSolveStatus::kQueueWaitTimedOut,
          .output = std::nullopt,
      });
    });
  }
}

void SolveCoordinator::CompletionLoop() {
  while (true) {
    CompletionTask task;
    {
      std::unique_lock<std::mutex> lock(completion_mutex_);
      completion_condition_.wait(
          lock, [this] { return completion_shutting_down_ || !completion_queue_.empty(); });
      if (completion_shutting_down_ && completion_queue_.empty()) {
        return;
      }

      task = std::move(completion_queue_.front());
      completion_queue_.pop_front();
    }

    task();
  }
}

} // namespace deliveryoptimizer::api
