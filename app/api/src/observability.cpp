#include "deliveryoptimizer/api/observability.hpp"

#include <array>
#include <iomanip>
#include <iostream>
#include <json/json.h>
#include <limits>
#include <ostream>
#include <sstream>
#include <string>
#include <utility>

namespace {

using SteadyClock = std::chrono::steady_clock;

struct HistogramBucket {
  double upper_bound;
  std::string_view label;
};

constexpr std::array<HistogramBucket, 12> kHistogramBuckets{{
    {0.005, "0.005"},
    {0.01, "0.01"},
    {0.025, "0.025"},
    {0.05, "0.05"},
    {0.1, "0.1"},
    {0.25, "0.25"},
    {0.5, "0.5"},
    {1.0, "1"},
    {2.5, "2.5"},
    {5.0, "5"},
    {10.0, "10"},
    {30.0, "30"},
}};

[[nodiscard]] double DurationToSeconds(const SteadyClock::duration duration) {
  return std::chrono::duration<double>(duration).count();
}

[[nodiscard]] std::int64_t DurationToMilliseconds(const SteadyClock::duration duration) {
  return std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();
}

[[nodiscard]] std::string FormatPrometheusDouble(const double value) {
  if (value == std::numeric_limits<double>::infinity()) {
    return "+Inf";
  }

  std::ostringstream stream;
  stream << std::setprecision(15) << value;
  return stream.str();
}

void AppendCounter(std::string& output, const std::string_view name, const std::string_view help,
                   const std::uint64_t value) {
  output.append("# HELP ");
  output.append(name);
  output.push_back(' ');
  output.append(help);
  output.push_back('\n');
  output.append("# TYPE ");
  output.append(name);
  output.append(" counter\n");
  output.append(name);
  output.push_back(' ');
  output.append(std::to_string(value));
  output.push_back('\n');
}

void AppendGauge(std::string& output, const std::string_view name, const std::string_view help,
                 const std::uint64_t value) {
  output.append("# HELP ");
  output.append(name);
  output.push_back(' ');
  output.append(help);
  output.push_back('\n');
  output.append("# TYPE ");
  output.append(name);
  output.append(" gauge\n");
  output.append(name);
  output.push_back(' ');
  output.append(std::to_string(value));
  output.push_back('\n');
}

} // namespace

namespace deliveryoptimizer::api {

struct ObservabilityRegistry::Histogram {
  struct Snapshot {
    std::array<std::uint64_t, kHistogramBuckets.size()> bucket_counts{};
    std::uint64_t plus_inf_count{0U};
    double sum{0.0};
    std::uint64_t count{0U};
  };

  void Observe(const double value) {
    std::lock_guard<std::mutex> lock(mutex);

    ++count;
    sum += value;
    const auto* bucket = kHistogramBuckets.data();
    auto* bucket_count = bucket_counts.data();
    const auto* const buckets_end = kHistogramBuckets.data() + kHistogramBuckets.size();
    for (; bucket != buckets_end; ++bucket, ++bucket_count) {
      if (value <= bucket->upper_bound) {
        ++(*bucket_count);
        return;
      }
    }

    ++plus_inf_count;
  }

  [[nodiscard]] Snapshot GetSnapshot() const {
    std::lock_guard<std::mutex> lock(mutex);
    return Snapshot{
        .bucket_counts = bucket_counts,
        .plus_inf_count = plus_inf_count,
        .sum = sum,
        .count = count,
    };
  }

  mutable std::mutex mutex;
  std::array<std::uint64_t, kHistogramBuckets.size()> bucket_counts{};
  std::uint64_t plus_inf_count{0U};
  double sum{0.0};
  std::uint64_t count{0U};
};

std::string_view ToOutcomeString(const SolveRequestOutcome outcome) {
  switch (outcome) {
  case SolveRequestOutcome::kAcceptedAsync:
    return "accepted_async";
  case SolveRequestOutcome::kSucceeded:
    return "succeeded";
  case SolveRequestOutcome::kRejectedTooManyJobs:
    return "rejected_too_many_jobs";
  case SolveRequestOutcome::kRejectedTooManyVehicles:
    return "rejected_too_many_vehicles";
  case SolveRequestOutcome::kRejectedQueueFull:
    return "rejected_queue_full";
  case SolveRequestOutcome::kQueueWaitTimedOut:
    return "queue_wait_timed_out";
  case SolveRequestOutcome::kSolveTimedOut:
    return "solve_timed_out";
  case SolveRequestOutcome::kFailed:
    return "failed";
  case SolveRequestOutcome::kInvalidJson:
    return "invalid_json";
  case SolveRequestOutcome::kValidationFailed:
    return "validation_failed";
  case SolveRequestOutcome::kRequestTooLarge:
    return "request_too_large";
  }

  return "failed";
}

ObservabilityRegistry::ObservabilityRegistry(const ObservabilityOptions options)
    : max_pending_log_lines_(options.max_pending_log_lines),
      queue_wait_histogram_(std::make_unique<Histogram>()),
      solve_duration_histogram_(std::make_unique<Histogram>()),
      request_duration_histogram_(std::make_unique<Histogram>()) {
  if (options.start_log_writer) {
    log_writer_ = std::thread([this] { LogWriterLoop(); });
  }
}

ObservabilityRegistry::~ObservabilityRegistry() {
  {
    std::lock_guard<std::mutex> lock(log_mutex_);
    log_shutdown_ = true;
  }
  log_condition_.notify_one();
  if (log_writer_.joinable()) {
    log_writer_.join();
  }
}

void ObservabilityRegistry::RecordAccepted() {
  accepted_requests_.fetch_add(1U, std::memory_order_relaxed);
}

void ObservabilityRegistry::RecordSucceeded() {
  succeeded_requests_.fetch_add(1U, std::memory_order_relaxed);
}

void ObservabilityRegistry::RecordRejected() {
  rejected_requests_.fetch_add(1U, std::memory_order_relaxed);
}

void ObservabilityRegistry::RecordTimedOut() {
  timed_out_requests_.fetch_add(1U, std::memory_order_relaxed);
}

void ObservabilityRegistry::RecordFailed() {
  failed_requests_.fetch_add(1U, std::memory_order_relaxed);
}

void ObservabilityRegistry::RecordAsyncJobCompletion(const SolveRequestOutcome outcome) {
  switch (outcome) {
  case SolveRequestOutcome::kSucceeded:
    RecordSucceeded();
    break;
  case SolveRequestOutcome::kQueueWaitTimedOut:
  case SolveRequestOutcome::kSolveTimedOut:
    RecordTimedOut();
    break;
  case SolveRequestOutcome::kFailed:
    RecordFailed();
    break;
  case SolveRequestOutcome::kAcceptedAsync:
  case SolveRequestOutcome::kRejectedTooManyJobs:
  case SolveRequestOutcome::kRejectedTooManyVehicles:
  case SolveRequestOutcome::kRejectedQueueFull:
  case SolveRequestOutcome::kInvalidJson:
  case SolveRequestOutcome::kValidationFailed:
  case SolveRequestOutcome::kRequestTooLarge:
    break;
  }
}

void ObservabilityRegistry::RecordTrackerWriteFailure() {
  tracker_write_failures_.fetch_add(1U, std::memory_order_relaxed);
}

void ObservabilityRegistry::SetSolverState(const std::size_t queue_depth,
                                           const std::size_t inflight_solves) {
  queue_depth_.store(queue_depth, std::memory_order_relaxed);
  inflight_solves_.store(inflight_solves, std::memory_order_relaxed);
}

void ObservabilityRegistry::SetAsyncJobState(const std::size_t queued_jobs,
                                             const std::size_t running_jobs,
                                             const std::size_t healthy_workers) {
  async_job_queue_depth_.store(queued_jobs, std::memory_order_relaxed);
  async_job_running_.store(running_jobs, std::memory_order_relaxed);
  async_job_workers_healthy_.store(healthy_workers, std::memory_order_relaxed);
}

void ObservabilityRegistry::ObserveQueueWait(const SteadyClock::duration duration) {
  queue_wait_histogram_->Observe(DurationToSeconds(duration));
}

void ObservabilityRegistry::ObserveSolveDuration(const SteadyClock::duration duration) {
  solve_duration_histogram_->Observe(DurationToSeconds(duration));
}

void ObservabilityRegistry::ObserveRequestDuration(const SteadyClock::duration duration) {
  request_duration_histogram_->Observe(DurationToSeconds(duration));
}

std::uint64_t ObservabilityRegistry::QueueDepth() const {
  return queue_depth_.load(std::memory_order_relaxed);
}

std::uint64_t ObservabilityRegistry::InflightSolves() const {
  return inflight_solves_.load(std::memory_order_relaxed);
}

void FinalizeSolveRequest(const std::shared_ptr<ObservabilityRegistry>& observability,
                          const std::shared_ptr<SolveLifecycle>& lifecycle,
                          const SolveRequestOutcome outcome, const std::uint16_t http_status) {
  if (observability == nullptr || lifecycle == nullptr) {
    return;
  }

  if (!lifecycle->completed_at.has_value()) {
    lifecycle->completed_at = std::chrono::steady_clock::now();
  }

  observability->ObserveRequestDuration(*lifecycle->completed_at - lifecycle->request_started_at);
  if (lifecycle->accepted) {
    observability->ObserveQueueWait(lifecycle->queue_wait_duration);
    if (lifecycle->solve_started_at.has_value()) {
      observability->ObserveSolveDuration(lifecycle->solve_duration);
    }
  }

  switch (outcome) {
  case SolveRequestOutcome::kAcceptedAsync:
    break;
  case SolveRequestOutcome::kSucceeded:
    observability->RecordSucceeded();
    break;
  case SolveRequestOutcome::kRejectedTooManyJobs:
  case SolveRequestOutcome::kRejectedTooManyVehicles:
  case SolveRequestOutcome::kRejectedQueueFull:
    observability->RecordRejected();
    break;
  case SolveRequestOutcome::kQueueWaitTimedOut:
  case SolveRequestOutcome::kSolveTimedOut:
    observability->RecordTimedOut();
    break;
  case SolveRequestOutcome::kFailed:
    if (lifecycle->accepted) {
      observability->RecordFailed();
    }
    break;
  case SolveRequestOutcome::kInvalidJson:
  case SolveRequestOutcome::kValidationFailed:
  case SolveRequestOutcome::kRequestTooLarge:
    observability->RecordRejected();
    break;
  }

  observability->LogSolveRequest(*lifecycle, outcome, http_status);
}

std::string ObservabilityRegistry::RenderPrometheusText() const {
  const auto append_histogram = [](std::string& output, const std::string_view name,
                                   const std::string_view help, const Histogram& histogram) {
    const auto snapshot = histogram.GetSnapshot();

    output.append("# HELP ");
    output.append(name);
    output.push_back(' ');
    output.append(help);
    output.push_back('\n');
    output.append("# TYPE ");
    output.append(name);
    output.append(" histogram\n");

    std::uint64_t cumulative = 0U;
    const auto* bucket = kHistogramBuckets.data();
    const auto* bucket_count = snapshot.bucket_counts.data();
    const auto* const buckets_end = kHistogramBuckets.data() + kHistogramBuckets.size();
    for (; bucket != buckets_end; ++bucket, ++bucket_count) {
      cumulative += *bucket_count;
      output.append(name);
      output.append("_bucket{le=\"");
      output.append(bucket->label);
      output.append("\"} ");
      output.append(std::to_string(cumulative));
      output.push_back('\n');
    }

    cumulative += snapshot.plus_inf_count;
    output.append(name);
    output.append("_bucket{le=\"+Inf\"} ");
    output.append(std::to_string(cumulative));
    output.push_back('\n');
    output.append(name);
    output.append("_sum ");
    output.append(FormatPrometheusDouble(snapshot.sum));
    output.push_back('\n');
    output.append(name);
    output.append("_count ");
    output.append(std::to_string(snapshot.count));
    output.push_back('\n');
  };

  std::string output;
  output.reserve(4096);

  AppendCounter(output, "deliveryoptimizer_solver_requests_accepted_total",
                "Count of solver requests accepted into the coordinator queue.",
                accepted_requests_.load(std::memory_order_relaxed));
  AppendCounter(output, "deliveryoptimizer_solver_requests_succeeded_total",
                "Count of accepted solver requests that completed successfully.",
                succeeded_requests_.load(std::memory_order_relaxed));
  AppendCounter(output, "deliveryoptimizer_solver_requests_rejected_total",
                "Count of solver requests rejected before execution.",
                rejected_requests_.load(std::memory_order_relaxed));
  AppendCounter(output, "deliveryoptimizer_solver_requests_timed_out_total",
                "Count of solver requests that timed out in queue or execution.",
                timed_out_requests_.load(std::memory_order_relaxed));
  AppendCounter(output, "deliveryoptimizer_solver_requests_failed_total",
                "Count of accepted solver requests that failed with a backend error.",
                failed_requests_.load(std::memory_order_relaxed));
  AppendCounter(output, "deliveryoptimizer_request_tracker_write_failures_total",
                "Count of request tracker log lines dropped or failed during write.",
                tracker_write_failures_.load(std::memory_order_relaxed));

  AppendGauge(output, "deliveryoptimizer_solver_inflight",
              "Current number of inflight solver executions.", InflightSolves());
  AppendGauge(output, "deliveryoptimizer_solver_queue_depth",
              "Current number of queued solver requests.", QueueDepth());
  AppendGauge(output, "deliveryoptimizer_async_job_queue_depth",
              "Current number of queued optimization jobs.",
              async_job_queue_depth_.load(std::memory_order_relaxed));
  AppendGauge(output, "deliveryoptimizer_async_job_running",
              "Current number of running optimization jobs.",
              async_job_running_.load(std::memory_order_relaxed));
  AppendGauge(output, "deliveryoptimizer_async_job_workers_healthy",
              "Current number of healthy optimization job workers.",
              async_job_workers_healthy_.load(std::memory_order_relaxed));

  append_histogram(output, "deliveryoptimizer_solver_queue_wait_seconds",
                   "Time spent waiting in the solver queue for accepted requests.",
                   *queue_wait_histogram_);
  append_histogram(output, "deliveryoptimizer_solver_duration_seconds",
                   "Time spent executing the solver for started requests.",
                   *solve_duration_histogram_);
  append_histogram(output, "deliveryoptimizer_solver_request_duration_seconds",
                   "End-to-end request duration for deliveries optimize requests.",
                   *request_duration_histogram_);

  return output;
}

void ObservabilityRegistry::LogSolveRequest(const SolveLifecycle& lifecycle,
                                            const SolveRequestOutcome outcome,
                                            const std::uint16_t http_status) {
  const auto completed_at = lifecycle.completed_at.value_or(SteadyClock::now());
  const auto request_duration = completed_at - lifecycle.request_started_at;

  Json::Value log_line{Json::objectValue};
  log_line["request_id"] = lifecycle.request_id;
  log_line["method"] = lifecycle.method;
  log_line["path"] = lifecycle.path;
  log_line["jobs"] = static_cast<Json::UInt64>(lifecycle.jobs);
  log_line["vehicles"] = static_cast<Json::UInt64>(lifecycle.vehicles);
  log_line["queue_depth"] = static_cast<Json::UInt64>(lifecycle.queue_depth);
  log_line["inflight_solves"] = static_cast<Json::UInt64>(lifecycle.inflight_solves);
  log_line["outcome"] = std::string{ToOutcomeString(outcome)};
  log_line["http_status"] = http_status;
  log_line["queue_wait_ms"] =
      static_cast<Json::Int64>(DurationToMilliseconds(lifecycle.queue_wait_duration));
  log_line["solve_duration_ms"] =
      static_cast<Json::Int64>(DurationToMilliseconds(lifecycle.solve_duration));
  log_line["request_duration_ms"] =
      static_cast<Json::Int64>(DurationToMilliseconds(request_duration));

  Json::StreamWriterBuilder writer_builder;
  writer_builder["indentation"] = "";
  writer_builder["commentStyle"] = "None";
  writer_builder["emitUTF8"] = true;

  const std::string rendered_line = Json::writeString(writer_builder, log_line);

  bool notify_writer = false;
  {
    std::lock_guard<std::mutex> lock(log_mutex_);
    if (max_pending_log_lines_ == 0U) {
      tracker_write_failures_.fetch_add(1U, std::memory_order_relaxed);
    } else {
      if (pending_log_lines_.size() >= max_pending_log_lines_) {
        // Prefer the newest request summaries once the async logger is saturated.
        pending_log_lines_.pop_front();
        tracker_write_failures_.fetch_add(1U, std::memory_order_relaxed);
      }
      pending_log_lines_.push_back(rendered_line);
      notify_writer = true;
    }
  }
  if (notify_writer) {
    log_condition_.notify_one();
  }
}

void ObservabilityRegistry::LogWriterLoop() {
  std::unique_lock<std::mutex> lock(log_mutex_);
  while (true) {
    log_condition_.wait(lock, [this] { return log_shutdown_ || !pending_log_lines_.empty(); });
    if (pending_log_lines_.empty()) {
      if (log_shutdown_) {
        return;
      }
      continue;
    }

    std::string rendered_line = std::move(pending_log_lines_.front());
    pending_log_lines_.pop_front();
    lock.unlock();
    std::cout << rendered_line << '\n' << std::flush;
    lock.lock();
  }
}

} // namespace deliveryoptimizer::api
