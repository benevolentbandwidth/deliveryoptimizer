#include "deliveryoptimizer/api/optimization_job_runtime.hpp"

#include "deliveryoptimizer/api/optimize_request.hpp"
#include "deliveryoptimizer/api/solve_execution.hpp"

#include <drogon/utils/Utilities.h>
#include <json/json.h>

#include <chrono>
#include <thread>

namespace {

[[nodiscard]] std::optional<Json::Value> ParseJsonText(const std::string& text) {
  Json::CharReaderBuilder builder;
  builder["collectComments"] = false;

  Json::Value root;
  JSONCPP_STRING errors;
  std::unique_ptr<Json::CharReader> reader{builder.newCharReader()};
  const char* begin = text.data();
  const char* end = begin + text.size();
  if (!reader->parse(begin, end, &root, &errors)) {
    return std::nullopt;
  }

  return root;
}

[[nodiscard]] std::string BuildWorkerIdPrefix() {
  return "opt-worker-" + drogon::utils::getUuid();
}

} // namespace

namespace deliveryoptimizer::api {

OptimizationJobRuntime::OptimizationJobRuntime(std::shared_ptr<OptimizationJobStore> store,
                                               std::shared_ptr<const VroomRunner> runner,
                                               std::shared_ptr<ObservabilityRegistry> observability,
                                               OptimizationJobRuntimeOptions options)
    : store_(std::move(store)),
      runner_(std::move(runner)),
      observability_(std::move(observability)),
      options_(options) {
  if (store_ != nullptr && store_->IsConfigured()) {
    schema_ready_ = store_->EnsureSchema(&schema_status_detail_);
  }

  if (store_ == nullptr || runner_ == nullptr || !schema_ready_) {
    RefreshObservability();
    return;
  }

  const std::string worker_id_prefix = BuildWorkerIdPrefix();
  for (std::size_t index = 0U; index < options_.worker_count; ++index) {
    worker_states_.emplace_back();
    worker_states_.back().worker_id =
        worker_id_prefix + "-" + std::to_string(index + 1U);
  }

  if (!options_.start_workers) {
    RefreshObservability();
    return;
  }

  workers_.reserve(options_.worker_count);
  for (std::size_t index = 0U; index < options_.worker_count; ++index) {
    workers_.emplace_back([this, index](std::stop_token stop_token) { WorkerLoop(stop_token, index); });
  }
  heartbeat_thread_ = std::jthread([this](std::stop_token stop_token) { HeartbeatLoop(stop_token); });
  sweep_thread_ = std::jthread([this](std::stop_token stop_token) { SweepLoop(stop_token); });
  RefreshObservability();
}

OptimizationJobRuntime::~OptimizationJobRuntime() {
  sweep_thread_ = std::jthread{};
  heartbeat_thread_ = std::jthread{};
  workers_.clear();
}

bool OptimizationJobRuntime::IsConfigured() const {
  return store_ != nullptr && store_->IsConfigured();
}

bool OptimizationJobRuntime::IsSchemaReady() const {
  return schema_ready_;
}

std::string OptimizationJobRuntime::SchemaStatusDetail() const {
  return schema_status_detail_;
}

std::size_t OptimizationJobRuntime::ExpectedWorkerCount() const {
  return worker_states_.size();
}

std::size_t OptimizationJobRuntime::HealthyWorkerCount() const {
  std::lock_guard<std::mutex> lock(stats_mutex_);
  return healthy_workers_;
}

OptimizationJobStoreStats OptimizationJobRuntime::CurrentStats() const {
  std::lock_guard<std::mutex> lock(stats_mutex_);
  return last_stats_;
}

void OptimizationJobRuntime::WorkerLoop(const std::stop_token stop_token, const std::size_t worker_index) {
  WorkerState& worker_state = worker_states_[worker_index];
  while (!stop_token.stop_requested()) {
    const auto claimed_job = store_->ClaimNextJob(worker_state.worker_id);
    if (!claimed_job.has_value()) {
      (void)store_->TouchWorker(worker_state.worker_id, std::nullopt);
      RefreshObservability();
      std::this_thread::sleep_for(options_.poll_interval);
      continue;
    }

    {
      std::lock_guard<std::mutex> lock(worker_state.mutex);
      worker_state.current_job_id = claimed_job->record.job_id;
    }
    (void)store_->TouchWorker(worker_state.worker_id, worker_state.current_job_id);
    RefreshObservability();

    const auto parsed_json = ParseJsonText(claimed_job->request_json);
    Json::Value issues{Json::arrayValue};
    const auto parsed_request =
        parsed_json.has_value() ? ParseAndValidateOptimizeRequest(*parsed_json, issues) : std::nullopt;
    if (!parsed_request.has_value()) {
      (void)store_->CompleteJobFailure(claimed_job->record.job_id, claimed_job->worker_id,
                                       OptimizationJobState::kFailed,
                                       SolveRequestOutcome::kFailed, 500U,
                                       "Stored optimization request is invalid.");
    } else {
      const auto solve_result = BuildSolveExecutionResult(parsed_request->input,
                                                          runner_->Run(BuildVroomInput(parsed_request->input)));
      if (solve_result.response_body.has_value()) {
        (void)store_->CompleteJobSuccess(claimed_job->record.job_id, claimed_job->worker_id,
                                         *solve_result.response_body,
                                         solve_result.outcome, solve_result.http_status);
      } else {
        const OptimizationJobState final_state =
            solve_result.status == SolveExecutionStatus::kTimedOut
                ? OptimizationJobState::kTimedOut
                : OptimizationJobState::kFailed;
        (void)store_->CompleteJobFailure(claimed_job->record.job_id, claimed_job->worker_id,
                                         final_state,
                                         solve_result.outcome, solve_result.http_status,
                                         solve_result.error_message);
      }
    }

    {
      std::lock_guard<std::mutex> lock(worker_state.mutex);
      worker_state.current_job_id.reset();
    }
    (void)store_->TouchWorker(worker_state.worker_id, std::nullopt);
    RefreshObservability();
  }
}

void OptimizationJobRuntime::HeartbeatLoop(const std::stop_token stop_token) {
  while (!stop_token.stop_requested()) {
    for (auto& worker_state : worker_states_) {
      std::optional<std::string> current_job_id;
      {
        std::lock_guard<std::mutex> lock(worker_state.mutex);
        current_job_id = worker_state.current_job_id;
      }

      (void)store_->TouchWorker(worker_state.worker_id, current_job_id);
      if (current_job_id.has_value()) {
        (void)store_->ExtendJobLease(*current_job_id, worker_state.worker_id);
      }
    }
    RefreshObservability();
    std::this_thread::sleep_for(options_.heartbeat_interval);
  }
}

void OptimizationJobRuntime::SweepLoop(const std::stop_token stop_token) {
  while (!stop_token.stop_requested()) {
    (void)store_->RequeueExpiredRunningJobs();
    (void)store_->ExpireFinishedJobs();
    RefreshObservability();
    std::this_thread::sleep_for(options_.sweep_interval);
  }
}

void OptimizationJobRuntime::RefreshObservability() {
  if (observability_ == nullptr || store_ == nullptr || !store_->IsConfigured()) {
    return;
  }

  const auto stats = store_->GetStats();
  const auto healthy_workers = store_->CountHealthyWorkers(options_.worker_health_timeout);
  {
    std::lock_guard<std::mutex> lock(stats_mutex_);
    last_stats_ = stats;
    healthy_workers_ = healthy_workers;
  }
  observability_->SetAsyncJobState(stats.queued_jobs, stats.running_jobs, healthy_workers);
}

} // namespace deliveryoptimizer::api
