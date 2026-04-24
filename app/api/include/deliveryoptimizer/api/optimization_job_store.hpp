#pragma once

#include "deliveryoptimizer/api/observability.hpp"

#include <chrono>
#include <cstddef>
#include <cstdint>
#include <json/json.h>
#include <memory>
#include <optional>
#include <string>
#include <string_view>

namespace drogon::orm {
class DbClient;
}

namespace deliveryoptimizer::api {

enum class OptimizationJobState : std::uint8_t {
  kQueued,
  kRunning,
  kSucceeded,
  kFailed,
  kTimedOut,
  kExpired,
};

enum class OptimizationJobFailureState : std::uint8_t {
  kFailed,
  kTimedOut,
};

[[nodiscard]] std::string_view ToOptimizationJobStateString(OptimizationJobState state);
[[nodiscard]] std::string_view ToOptimizationJobStateString(OptimizationJobFailureState state);
[[nodiscard]] std::optional<OptimizationJobState> ParseOptimizationJobState(std::string_view state);
[[nodiscard]] std::optional<SolveRequestOutcome> ParseSolveRequestOutcome(std::string_view outcome);

struct OptimizationJobRecord {
  std::string job_id;
  std::string request_id;
  OptimizationJobState state{OptimizationJobState::kQueued};
  std::size_t jobs{0U};
  std::size_t vehicles{0U};
  std::string queued_at;
  std::optional<std::string> started_at;
  std::optional<std::string> completed_at;
  std::optional<std::string> expires_at;
  std::optional<SolveRequestOutcome> outcome;
  std::optional<std::uint16_t> http_status;
  std::optional<std::string> error_message;
  std::optional<Json::Value> result_body;
};

struct ClaimedOptimizationJob {
  OptimizationJobRecord record;
  std::string request_json;
  std::string worker_id;
};

struct OptimizationJobStoreStats {
  std::size_t queued_jobs{0U};
  std::size_t running_jobs{0U};
};

enum class CreateOptimizationJobStatus : std::uint8_t {
  kCreated,
  kQueueFull,
  kError,
};

struct CreateOptimizationJobResult {
  CreateOptimizationJobStatus status{CreateOptimizationJobStatus::kError};
  std::optional<OptimizationJobRecord> record;
};

struct OptimizationJobStoreConfig {
  std::string connection_string;
  std::size_t connection_count{4U};
  std::size_t max_queue_size{8U};
  std::size_t max_attempts{3U};
  std::chrono::milliseconds lease_duration{std::chrono::milliseconds{90000}};
  std::chrono::seconds result_ttl{std::chrono::hours{24}};
};

class OptimizationJobStore {
public:
  explicit OptimizationJobStore(OptimizationJobStoreConfig config);

  [[nodiscard]] bool IsConfigured() const;
  [[nodiscard]] const OptimizationJobStoreConfig& config() const;

  [[nodiscard]] bool Ping(std::string* detail = nullptr);
  [[nodiscard]] bool EnsureSchema(std::string* detail = nullptr);

  [[nodiscard]] CreateOptimizationJobResult CreateJob(const std::string& request_id,
                                                      const std::string& request_json,
                                                      std::size_t jobs,
                                                      std::size_t vehicles);

  [[nodiscard]] std::optional<ClaimedOptimizationJob> ClaimNextJob(const std::string& worker_id);

  [[nodiscard]] bool CompleteJobSuccess(const std::string& job_id,
                                        const std::string& worker_id,
                                        const Json::Value& result_body,
                                        SolveRequestOutcome outcome,
                                        std::uint16_t http_status);

  [[nodiscard]] bool CompleteJobFailure(const std::string& job_id,
                                        const std::string& worker_id,
                                        OptimizationJobFailureState state,
                                        SolveRequestOutcome outcome, std::uint16_t http_status,
                                        const std::string& error_message);

  [[nodiscard]] bool TouchWorker(const std::string& worker_id,
                                 const std::optional<std::string>& current_job_id);

  [[nodiscard]] bool ExtendJobLease(const std::string& job_id, const std::string& worker_id);

  [[nodiscard]] std::size_t RequeueExpiredRunningJobs();
  [[nodiscard]] std::size_t ExpireFinishedJobs();

  [[nodiscard]] std::optional<OptimizationJobRecord> GetJob(const std::string& job_id);
  [[nodiscard]] OptimizationJobStoreStats GetStats();
  [[nodiscard]] std::size_t CountHealthyWorkers(std::chrono::milliseconds max_age);

private:
  std::optional<OptimizationJobRecord> ReadJobById(const std::string& job_id);

  OptimizationJobStoreConfig config_;
  std::shared_ptr<drogon::orm::DbClient> client_;
};

} // namespace deliveryoptimizer::api
