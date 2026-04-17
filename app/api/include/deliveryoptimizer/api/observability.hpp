#pragma once

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstddef>
#include <cstdint>
#include <deque>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <string_view>
#include <thread>

namespace drogon {
class HttpRequest;
using HttpRequestPtr = std::shared_ptr<HttpRequest>;
} // namespace drogon

namespace deliveryoptimizer::api {

inline constexpr std::string_view kRequestIdHeader = "X-Request-Id";

struct RequestContext {
  std::string request_id;
  std::chrono::steady_clock::time_point started_at;
};

struct SolveLifecycle {
  std::string request_id;
  std::string method;
  std::string path;
  std::size_t jobs{0U};
  std::size_t vehicles{0U};
  std::chrono::steady_clock::time_point request_started_at;
  std::optional<std::chrono::steady_clock::time_point> queued_at;
  std::optional<std::chrono::steady_clock::time_point> solve_started_at;
  std::optional<std::chrono::steady_clock::time_point> completed_at;
  std::chrono::steady_clock::duration queue_wait_duration{};
  std::chrono::steady_clock::duration solve_duration{};
  std::size_t queue_depth{0U};
  std::size_t inflight_solves{0U};
  bool accepted{false};
};

class ObservabilityRegistry;

enum class SolveRequestOutcome : std::uint8_t {
  kAcceptedAsync,
  kSucceeded,
  kRejectedTooManyJobs,
  kRejectedTooManyVehicles,
  kRejectedQueueFull,
  kQueueWaitTimedOut,
  kSolveTimedOut,
  kFailed,
  kInvalidJson,
  kValidationFailed,
  kRequestTooLarge,
};

struct ObservabilityOptions {
  std::size_t max_pending_log_lines{1024U};
  bool start_log_writer{true};
};

void EnsureRequestContext(const drogon::HttpRequestPtr& request);
[[nodiscard]] std::optional<RequestContext>
GetRequestContext(const drogon::HttpRequestPtr& request);
[[nodiscard]] SolveLifecycle CreateSolveLifecycle(const drogon::HttpRequestPtr& request);
[[nodiscard]] std::string_view ToOutcomeString(SolveRequestOutcome outcome);
void FinalizeSolveRequest(const std::shared_ptr<ObservabilityRegistry>& observability,
                          const std::shared_ptr<SolveLifecycle>& lifecycle,
                          SolveRequestOutcome outcome, std::uint16_t http_status);

class ObservabilityRegistry {
public:
  explicit ObservabilityRegistry(ObservabilityOptions options = {});
  ~ObservabilityRegistry();

  ObservabilityRegistry(const ObservabilityRegistry&) = delete;
  ObservabilityRegistry& operator=(const ObservabilityRegistry&) = delete;
  ObservabilityRegistry(ObservabilityRegistry&&) = delete;
  ObservabilityRegistry& operator=(ObservabilityRegistry&&) = delete;

  void RecordAccepted();
  void RecordSucceeded();
  void RecordRejected();
  void RecordTimedOut();
  void RecordFailed();
  void RecordAsyncJobCompletion(SolveRequestOutcome outcome);
  void RecordTrackerWriteFailure();

  void SetSolverState(std::size_t queue_depth, std::size_t inflight_solves);
  void SetAsyncJobState(std::size_t queued_jobs, std::size_t running_jobs,
                        std::size_t healthy_workers);
  void ObserveQueueWait(std::chrono::steady_clock::duration duration);
  void ObserveSolveDuration(std::chrono::steady_clock::duration duration);
  void ObserveRequestDuration(std::chrono::steady_clock::duration duration);

  [[nodiscard]] std::uint64_t QueueDepth() const;
  [[nodiscard]] std::uint64_t InflightSolves() const;
  [[nodiscard]] std::string RenderPrometheusText() const;
  void LogSolveRequest(const SolveLifecycle& lifecycle, SolveRequestOutcome outcome,
                       std::uint16_t http_status);

private:
  struct Histogram;
  void LogWriterLoop();

  std::atomic<std::uint64_t> accepted_requests_{0U};
  std::atomic<std::uint64_t> succeeded_requests_{0U};
  std::atomic<std::uint64_t> rejected_requests_{0U};
  std::atomic<std::uint64_t> timed_out_requests_{0U};
  std::atomic<std::uint64_t> failed_requests_{0U};
  std::atomic<std::uint64_t> tracker_write_failures_{0U};
  std::atomic<std::uint64_t> queue_depth_{0U};
  std::atomic<std::uint64_t> inflight_solves_{0U};
  std::atomic<std::uint64_t> async_job_queue_depth_{0U};
  std::atomic<std::uint64_t> async_job_running_{0U};
  std::atomic<std::uint64_t> async_job_workers_healthy_{0U};
  std::size_t max_pending_log_lines_{0U};
  std::unique_ptr<Histogram> queue_wait_histogram_;
  std::unique_ptr<Histogram> solve_duration_histogram_;
  std::unique_ptr<Histogram> request_duration_histogram_;
  std::mutex log_mutex_;
  std::condition_variable log_condition_;
  std::deque<std::string> pending_log_lines_;
  bool log_shutdown_{false};
  std::thread log_writer_;
};

} // namespace deliveryoptimizer::api
