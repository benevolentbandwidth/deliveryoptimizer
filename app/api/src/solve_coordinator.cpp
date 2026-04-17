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

[[nodiscard]] bool StartsImmediately(const deliveryoptimizer::api::SolveAdmissionConfig& config,
                                     const std::size_t active_solves,
                                     const std::size_t queued_solves) {
  const std::size_t accepted_solves = active_solves + queued_solves;
  return accepted_solves < config.max_concurrency;
}

[[nodiscard]] std::chrono::steady_clock::time_point
ResolveDeadline(const std::chrono::steady_clock::time_point queued_at,
                const std::chrono::milliseconds queue_wait) {
  const auto max_queue_wait = std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::steady_clock::duration::max());
  const auto clamped_queue_wait = std::min(queue_wait, max_queue_wait);
  const auto queue_wait_duration =
      std::chrono::duration_cast<std::chrono::steady_clock::duration>(clamped_queue_wait);
  const auto remaining_until_max = std::chrono::steady_clock::time_point::max() - queued_at;
  return queued_at + std::min(queue_wait_duration, remaining_until_max);
}

[[nodiscard]] std::size_t
ResolveCompletionWorkerCount(const deliveryoptimizer::api::SolveAdmissionConfig& config,
                             const deliveryoptimizer::api::SolveCoordinatorOptions& options) {
  return std::max<std::size_t>(1U,
                               options.completion_worker_count.value_or(config.max_concurrency));
}

void UpdateLifecycleState(const std::shared_ptr<deliveryoptimizer::api::SolveLifecycle>& lifecycle,
                          const std::size_t queue_depth, const std::size_t inflight_solves) {
  if (lifecycle == nullptr) {
    return;
  }

  lifecycle->queue_depth = queue_depth;
  lifecycle->inflight_solves = inflight_solves;
}

} // namespace

namespace deliveryoptimizer::api {

SolveCoordinator::SolveCoordinator(SolveAdmissionConfig config,
                                   std::shared_ptr<const VroomRunner> runner,
                                   SolveCoordinatorOptions options,
                                   std::shared_ptr<ObservabilityRegistry> observability)
    : config_(config), options_(options), runner_(std::move(runner)),
      observability_(std::move(observability)) {
  if (observability_ == nullptr) {
    observability_ = std::make_shared<ObservabilityRegistry>(ObservabilityOptions{
        .start_log_writer = options_.start_workers,
    });
  }
  observability_->SetSolverState(0U, 0U);

  const std::size_t completion_worker_count = ResolveCompletionWorkerCount(config_, options_);
  completion_workers_.reserve(completion_worker_count);
  for (std::size_t index = 0U; index < completion_worker_count; ++index) {
    completion_workers_.emplace_back([this] { CompletionLoop(); });
  }

  if (options_.start_workers) {
    workers_.reserve(config_.max_concurrency);
    for (std::size_t index = 0U; index < config_.max_concurrency; ++index) {
      workers_.emplace_back([this] { WorkerLoop(); });
    }
  }
  if (options_.enable_queue_timer) {
    queue_timer_ = std::jthread([this] { QueueTimerLoop(); });
  }
}

SolveCoordinator::~SolveCoordinator() {
  std::deque<QueuedSolveRequest> drained_queue;
  std::size_t active_solves = 0U;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    shutting_down_ = true;
    drained_queue = std::move(queue_);
    active_solves = active_solves_;
  }
  observability_->SetSolverState(0U, active_solves);
  condition_.notify_all();

  const auto completed_at = std::chrono::steady_clock::now();
  for (auto& queued_request : drained_queue) {
    EnqueueCompletion([callback = std::move(queued_request.callback)]() mutable {
      callback(CoordinatedSolveResult{
          .status = CoordinatedSolveStatus::kFailed,
          .output = std::nullopt,
      });
    });
    if (queued_request.lifecycle != nullptr) {
      queued_request.lifecycle->completed_at = completed_at;
      UpdateLifecycleState(queued_request.lifecycle, 0U, active_solves);
    }
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

SolveAdmissionStatus
SolveCoordinator::CheckAdmission(const SolveRequestSize& request_size,
                                 const std::shared_ptr<SolveLifecycle>& lifecycle) {
  std::lock_guard<std::mutex> lock(mutex_);
  return CheckAdmissionLocked(request_size, lifecycle);
}

SolveAdmissionStatus SolveCoordinator::Submit(const SolveRequestSize& request_size,
                                              PayloadFactory payload_factory,
                                              CompletionCallback callback,
                                              std::shared_ptr<SolveLifecycle> lifecycle) {
  std::lock_guard<std::mutex> lock(mutex_);
  const SolveAdmissionStatus admission_status = CheckAdmissionLocked(request_size, lifecycle);
  if (admission_status != SolveAdmissionStatus::kAccepted) {
    return admission_status;
  }

  const auto queued_at = std::chrono::steady_clock::now();
  const bool started_immediately = StartsImmediately(config_, active_solves_, queue_.size());
  if (lifecycle != nullptr) {
    lifecycle->accepted = true;
    lifecycle->queued_at = queued_at;
    lifecycle->queue_wait_duration = std::chrono::steady_clock::duration::zero();
    lifecycle->solve_duration = std::chrono::steady_clock::duration::zero();
    lifecycle->solve_started_at.reset();
    lifecycle->completed_at.reset();
  }
  queue_.push_back(QueuedSolveRequest{
      .payload_factory = std::move(payload_factory),
      .callback = std::move(callback),
      .deadline = started_immediately ? std::chrono::steady_clock::time_point::max()
                                      : ResolveDeadline(queued_at, config_.max_queue_wait),
      .lifecycle = std::move(lifecycle),
      .started_immediately = started_immediately,
  });
  ++queue_version_;
  observability_->RecordAccepted();
  observability_->SetSolverState(queue_.size(), active_solves_);
  UpdateLifecycleState(queue_.back().lifecycle, queue_.size(), active_solves_);
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

SolveAdmissionStatus
SolveCoordinator::CheckAdmissionLocked(const SolveRequestSize& request_size,
                                       const std::shared_ptr<SolveLifecycle>& lifecycle) {
  UpdateLifecycleState(lifecycle, queue_.size(), active_solves_);
  if (shutting_down_) {
    return SolveAdmissionStatus::kRejectedQueueFull;
  }

  return EvaluateSolveAdmission(config_, request_size, active_solves_, queue_.size());
}

void SolveCoordinator::WorkerLoop() {
  while (true) {
    std::optional<QueuedSolveRequest> queued_request;
    bool queue_wait_expired = false;
    std::chrono::steady_clock::time_point dequeued_at;
    {
      std::unique_lock<std::mutex> lock(mutex_);
      condition_.wait(lock, [this] { return shutting_down_ || !queue_.empty(); });
      if (shutting_down_ && queue_.empty()) {
        return;
      }

      queued_request = std::move(queue_.front());
      queue_.pop_front();
      ++queue_version_;
      dequeued_at = std::chrono::steady_clock::now();
      queue_wait_expired = HasQueueWaitExpired(queued_request->deadline);
      if (!queue_wait_expired) {
        ++active_solves_;
        if (queued_request->lifecycle != nullptr) {
          queued_request->lifecycle->solve_started_at = dequeued_at;
          queued_request->lifecycle->queue_wait_duration =
              queued_request->started_immediately
                  ? std::chrono::steady_clock::duration::zero()
                  : dequeued_at - queued_request->lifecycle->queued_at.value_or(dequeued_at);
        }
      } else if (queued_request->lifecycle != nullptr) {
        queued_request->lifecycle->queue_wait_duration =
            dequeued_at - queued_request->lifecycle->queued_at.value_or(dequeued_at);
        queued_request->lifecycle->completed_at = dequeued_at;
      }
      UpdateLifecycleState(queued_request->lifecycle, queue_.size(), active_solves_);
      observability_->SetSolverState(queue_.size(), active_solves_);
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
    const auto completed_at = std::chrono::steady_clock::now();
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (queued_request->lifecycle != nullptr) {
        queued_request->lifecycle->completed_at = completed_at;
        queued_request->lifecycle->solve_duration =
            completed_at - queued_request->lifecycle->solve_started_at.value_or(completed_at);
      }
      --active_solves_;
      UpdateLifecycleState(queued_request->lifecycle, queue_.size(), active_solves_);
      observability_->SetSolverState(queue_.size(), active_solves_);
    }
    condition_.notify_all();

    CoordinatedSolveResult coordinated_result = ToCoordinatedSolveResult(solve_result);
    EnqueueCompletion(
        [callback = std::move(queued_request->callback),
         result = std::move(coordinated_result)]() mutable { callback(std::move(result)); });
  }
}

void SolveCoordinator::QueueTimerLoop() {
  const auto find_earliest_deadline = [this] {
    return std::min_element(queue_.begin(), queue_.end(),
                            [](const QueuedSolveRequest& left, const QueuedSolveRequest& right) {
                              return left.deadline < right.deadline;
                            });
  };

  while (true) {
    std::optional<QueuedSolveRequest> expired_request;
    std::chrono::steady_clock::time_point expired_at;
    {
      std::unique_lock<std::mutex> lock(mutex_);
      condition_.wait(lock, [this] { return shutting_down_ || !queue_.empty(); });
      if (shutting_down_ && queue_.empty()) {
        return;
      }

      const std::uint64_t watched_queue_version = queue_version_;
      const auto earliest_deadline = find_earliest_deadline()->deadline;
      const bool queue_changed =
          condition_.wait_until(lock, earliest_deadline, [this, watched_queue_version] {
            return shutting_down_ || queue_.empty() || queue_version_ != watched_queue_version;
          });
      if (queue_changed) {
        if (shutting_down_ && queue_.empty()) {
          return;
        }
        continue;
      }

      if (queue_.empty()) {
        continue;
      }

      auto expired_request_it = find_earliest_deadline();
      if (expired_request_it == queue_.end() ||
          !HasQueueWaitExpired(expired_request_it->deadline)) {
        continue;
      }

      expired_request = std::move(*expired_request_it);
      queue_.erase(expired_request_it);
      ++queue_version_;
      expired_at = std::chrono::steady_clock::now();
      if (expired_request->lifecycle != nullptr) {
        expired_request->lifecycle->queue_wait_duration =
            expired_at - expired_request->lifecycle->queued_at.value_or(expired_at);
        expired_request->lifecycle->completed_at = expired_at;
      }
      UpdateLifecycleState(expired_request->lifecycle, queue_.size(), active_solves_);
      observability_->SetSolverState(queue_.size(), active_solves_);
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
