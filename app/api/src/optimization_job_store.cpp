#include "deliveryoptimizer/api/optimization_job_store.hpp"
#include "deliveryoptimizer/api/internal/json_utils.hpp"

#include <drogon/orm/DbClient.h>
#include <drogon/orm/Exception.h>
#include <drogon/utils/Utilities.h>

#include <json/json.h>

#include <optional>
#include <string>
#include <utility>

namespace {

constexpr long long kCreateJobAdmissionLockId = 1684234842LL;

[[nodiscard]] std::optional<std::string> ReadOptionalText(const drogon::orm::Row& row,
                                                          const char* column_name) {
  const auto field = row[column_name];
  if (field.isNull()) {
    return std::nullopt;
  }
  return field.as<std::string>();
}

[[nodiscard]] std::optional<std::uint16_t> ReadOptionalHttpStatus(const drogon::orm::Row& row) {
  const auto field = row["http_status"];
  if (field.isNull()) {
    return std::nullopt;
  }
  return static_cast<std::uint16_t>(field.as<int>());
}

[[nodiscard]] std::optional<deliveryoptimizer::api::SolveRequestOutcome>
ReadOptionalOutcome(const drogon::orm::Row& row) {
  const auto field = row["outcome"];
  if (field.isNull()) {
    return std::nullopt;
  }
  return deliveryoptimizer::api::ParseSolveRequestOutcome(field.as<std::string>());
}

[[nodiscard]] std::optional<Json::Value> ReadOptionalJson(const drogon::orm::Row& row,
                                                          const char* column_name) {
  const auto field = row[column_name];
  if (field.isNull()) {
    return std::nullopt;
  }
  return deliveryoptimizer::api::internal::ParseJsonText(field.as<std::string>());
}

[[nodiscard]] std::optional<deliveryoptimizer::api::OptimizationJobRecord>
ReadJobRecord(const drogon::orm::Result& result) {
  if (result.empty()) {
    return std::nullopt;
  }

  const drogon::orm::Row row = result.front();
  const auto state = deliveryoptimizer::api::ParseOptimizationJobState(row["status"].as<std::string>());
  if (!state.has_value()) {
    return std::nullopt;
  }

  return deliveryoptimizer::api::OptimizationJobRecord{
      .job_id = row["id"].as<std::string>(),
      .request_id = row["request_id"].as<std::string>(),
      .state = *state,
      .jobs = static_cast<std::size_t>(row["jobs_count"].as<long long>()),
      .vehicles = static_cast<std::size_t>(row["vehicles_count"].as<long long>()),
      .queued_at = row["queued_at"].as<std::string>(),
      .started_at = ReadOptionalText(row, "started_at"),
      .completed_at = ReadOptionalText(row, "completed_at"),
      .expires_at = ReadOptionalText(row, "expires_at"),
      .outcome = ReadOptionalOutcome(row),
      .http_status = ReadOptionalHttpStatus(row),
      .error_message = ReadOptionalText(row, "error_message"),
      .result_body = ReadOptionalJson(row, "result_json"),
  };
}

} // namespace

namespace deliveryoptimizer::api {

std::string_view ToOptimizationJobStateString(const OptimizationJobState state) {
  switch (state) {
  case OptimizationJobState::kQueued:
    return "queued";
  case OptimizationJobState::kRunning:
    return "running";
  case OptimizationJobState::kSucceeded:
    return "succeeded";
  case OptimizationJobState::kFailed:
    return "failed";
  case OptimizationJobState::kTimedOut:
    return "timed_out";
  case OptimizationJobState::kExpired:
    return "expired";
  }

  return "failed";
}

std::string_view ToOptimizationJobStateString(const OptimizationJobFailureState state) {
  switch (state) {
  case OptimizationJobFailureState::kFailed:
    return "failed";
  case OptimizationJobFailureState::kTimedOut:
    return "timed_out";
  }

  return "failed";
}

std::optional<OptimizationJobState> ParseOptimizationJobState(const std::string_view state) {
  if (state == "queued") {
    return OptimizationJobState::kQueued;
  }
  if (state == "running") {
    return OptimizationJobState::kRunning;
  }
  if (state == "succeeded") {
    return OptimizationJobState::kSucceeded;
  }
  if (state == "failed") {
    return OptimizationJobState::kFailed;
  }
  if (state == "timed_out") {
    return OptimizationJobState::kTimedOut;
  }
  if (state == "expired") {
    return OptimizationJobState::kExpired;
  }

  return std::nullopt;
}

std::optional<SolveRequestOutcome> ParseSolveRequestOutcome(const std::string_view outcome) {
  if (outcome == ToOutcomeString(SolveRequestOutcome::kAcceptedAsync)) {
    return SolveRequestOutcome::kAcceptedAsync;
  }
  if (outcome == ToOutcomeString(SolveRequestOutcome::kSucceeded)) {
    return SolveRequestOutcome::kSucceeded;
  }
  if (outcome == ToOutcomeString(SolveRequestOutcome::kRejectedTooManyJobs)) {
    return SolveRequestOutcome::kRejectedTooManyJobs;
  }
  if (outcome == ToOutcomeString(SolveRequestOutcome::kRejectedTooManyVehicles)) {
    return SolveRequestOutcome::kRejectedTooManyVehicles;
  }
  if (outcome == ToOutcomeString(SolveRequestOutcome::kRejectedQueueFull)) {
    return SolveRequestOutcome::kRejectedQueueFull;
  }
  if (outcome == ToOutcomeString(SolveRequestOutcome::kQueueWaitTimedOut)) {
    return SolveRequestOutcome::kQueueWaitTimedOut;
  }
  if (outcome == ToOutcomeString(SolveRequestOutcome::kSolveTimedOut)) {
    return SolveRequestOutcome::kSolveTimedOut;
  }
  if (outcome == ToOutcomeString(SolveRequestOutcome::kFailed)) {
    return SolveRequestOutcome::kFailed;
  }
  if (outcome == ToOutcomeString(SolveRequestOutcome::kInvalidJson)) {
    return SolveRequestOutcome::kInvalidJson;
  }
  if (outcome == ToOutcomeString(SolveRequestOutcome::kValidationFailed)) {
    return SolveRequestOutcome::kValidationFailed;
  }
  if (outcome == ToOutcomeString(SolveRequestOutcome::kRequestTooLarge)) {
    return SolveRequestOutcome::kRequestTooLarge;
  }

  return std::nullopt;
}

OptimizationJobStore::OptimizationJobStore(OptimizationJobStoreConfig config) : config_(std::move(config)) {
  if (!config_.connection_string.empty()) {
    client_ = drogon::orm::DbClient::newPgClient(config_.connection_string,
                                                 config_.connection_count, false);
  }
}

bool OptimizationJobStore::IsConfigured() const {
  return client_ != nullptr;
}

const OptimizationJobStoreConfig& OptimizationJobStore::config() const {
  return config_;
}

bool OptimizationJobStore::Ping(std::string* detail) {
  if (!IsConfigured()) {
    if (detail != nullptr) {
      *detail = "missing database connection string";
    }
    return false;
  }

  try {
    (void)client_->execSqlSync("select 1 from optimization_jobs limit 1");
    (void)client_->execSqlSync("select 1 from optimization_job_workers limit 1");
    if (detail != nullptr) {
      *detail = "ok";
    }
    return true;
  } catch (const drogon::orm::DrogonDbException& error) {
    if (detail != nullptr) {
      *detail = error.base().what();
    }
    return false;
  } catch (const std::exception& error) {
    if (detail != nullptr) {
      *detail = error.what();
    }
    return false;
  }
}

bool OptimizationJobStore::EnsureSchema(std::string* detail) {
  if (!IsConfigured()) {
    if (detail != nullptr) {
      *detail = "missing database connection string";
    }
    return false;
  }

  try {
    (void)client_->execSqlSync(
        "create table if not exists optimization_jobs ("
        "id text primary key,"
        "request_id text not null,"
        "request_json jsonb not null,"
        "status text not null,"
        "jobs_count bigint not null,"
        "vehicles_count bigint not null,"
        "attempt_count bigint not null default 0,"
        "worker_id text,"
        "queued_at timestamptz not null default now(),"
        "started_at timestamptz,"
        "completed_at timestamptz,"
        "updated_at timestamptz not null default now(),"
        "lease_expires_at timestamptz,"
        "last_heartbeat_at timestamptz,"
        "expires_at timestamptz,"
        "outcome text,"
        "http_status integer,"
        "error_message text,"
        "result_json jsonb"
        ")");
    (void)client_->execSqlSync(
        "create index if not exists optimization_jobs_status_queued_idx "
        "on optimization_jobs(status, queued_at)");
    (void)client_->execSqlSync(
        "create index if not exists optimization_jobs_lease_idx "
        "on optimization_jobs(status, lease_expires_at)");
    (void)client_->execSqlSync(
        "create table if not exists optimization_job_workers ("
        "worker_id text primary key,"
        "current_job_id text,"
        "started_at timestamptz not null default now(),"
        "last_heartbeat_at timestamptz not null default now(),"
        "updated_at timestamptz not null default now()"
        ")");
    if (detail != nullptr) {
      *detail = "ok";
    }
    return true;
  } catch (const drogon::orm::DrogonDbException& error) {
    if (detail != nullptr) {
      *detail = error.base().what();
    }
    return false;
  } catch (const std::exception& error) {
    if (detail != nullptr) {
      *detail = error.what();
    }
    return false;
  }
}

CreateOptimizationJobResult OptimizationJobStore::CreateJob(const std::string& request_id,
                                                            const std::string& request_json,
                                                            const std::size_t jobs,
                                                            const std::size_t vehicles) {
  if (!IsConfigured()) {
    return {
        .status = CreateOptimizationJobStatus::kError,
        .record = std::nullopt,
    };
  }

  const std::string job_id = drogon::utils::getUuid();
  try {
    const auto result = client_->execSqlSync(
        "with admission_lock as ("
        "  select pg_advisory_xact_lock($6::bigint)"
        "), queued_job_count as ("
        "  select count(*) as queued_jobs "
        "  from optimization_jobs "
        "  where status = 'queued'"
        ") "
        "insert into optimization_jobs("
        "id, request_id, request_json, status, jobs_count, vehicles_count"
        ") "
        "select $1, $2, $3::jsonb, 'queued', $4, $5 "
        "from admission_lock, queued_job_count "
        "where (select queued_jobs from queued_job_count) < $7 "
        "returning id, request_id, status, jobs_count, vehicles_count, "
        "queued_at::text as queued_at, started_at::text as started_at, "
        "completed_at::text as completed_at, expires_at::text as expires_at, "
        "outcome, http_status, error_message, result_json::text as result_json",
        job_id, request_id, request_json, static_cast<long long>(jobs),
        static_cast<long long>(vehicles), kCreateJobAdmissionLockId,
        static_cast<long long>(config_.max_queue_size));
    if (result.empty()) {
      return {
          .status = CreateOptimizationJobStatus::kQueueFull,
          .record = std::nullopt,
      };
    }

    auto record = ReadJobRecord(result);
    if (!record.has_value()) {
      return {
          .status = CreateOptimizationJobStatus::kError,
          .record = std::nullopt,
      };
    }

    return {
        .status = CreateOptimizationJobStatus::kCreated,
        .record = std::move(record),
    };
  } catch (...) {
    return {
        .status = CreateOptimizationJobStatus::kError,
        .record = std::nullopt,
    };
  }
}

std::optional<ClaimedOptimizationJob> OptimizationJobStore::ClaimNextJob(const std::string& worker_id) {
  if (!IsConfigured()) {
    return std::nullopt;
  }

  try {
    const auto result = client_->execSqlSync(
        "with next_job as ("
        "  select id "
        "  from optimization_jobs "
        "  where status = 'queued' "
        "  order by queued_at asc "
        "  for update skip locked "
        "  limit 1"
        ") "
        "update optimization_jobs as job "
        "set status = 'running', "
        "    worker_id = $1, "
        "    started_at = coalesce(job.started_at, now()), "
        "    updated_at = now(), "
        "    lease_expires_at = now() + (($2)::bigint * interval '1 millisecond'), "
        "    last_heartbeat_at = now(), "
        "    attempt_count = job.attempt_count + 1 "
        "from next_job "
        "where job.id = next_job.id "
        "returning job.id, job.request_id, job.request_json::text as request_json, "
        "job.status, job.jobs_count, job.vehicles_count, "
        "job.queued_at::text as queued_at, job.started_at::text as started_at, "
        "job.completed_at::text as completed_at, job.expires_at::text as expires_at, "
        "job.outcome, job.http_status, job.error_message, job.result_json::text as result_json",
        worker_id, static_cast<long long>(config_.lease_duration.count()));
    if (result.empty()) {
      return std::nullopt;
    }

    auto record = ReadJobRecord(result);
    if (!record.has_value()) {
      return std::nullopt;
    }

    return ClaimedOptimizationJob{
        .record = std::move(*record),
        .request_json = result.front()["request_json"].as<std::string>(),
        .worker_id = worker_id,
    };
  } catch (...) {
    return std::nullopt;
  }
}

bool OptimizationJobStore::CompleteJobSuccess(const std::string& job_id, const std::string& worker_id,
                                              const Json::Value& result_body,
                                              const SolveRequestOutcome outcome,
                                              const std::uint16_t http_status) {
  if (!IsConfigured()) {
    return false;
  }

  try {
    const auto result_json = internal::RenderJson(result_body);
    const auto result = client_->execSqlSync(
        "update optimization_jobs "
        "set status = 'succeeded', "
        "    completed_at = now(), "
        "    updated_at = now(), "
        "    worker_id = null, "
        "    lease_expires_at = null, "
        "    last_heartbeat_at = null, "
        "    expires_at = now() + (($3)::bigint * interval '1 second'), "
        "    outcome = $4, "
        "    http_status = $5, "
        "    error_message = null, "
        "    result_json = $6::jsonb "
        "where id = $1 and worker_id = $2 and status = 'running'",
        job_id, worker_id, static_cast<long long>(config_.result_ttl.count()),
        std::string{ToOutcomeString(outcome)}, static_cast<int>(http_status), result_json);
    return result.affectedRows() == 1U;
  } catch (...) {
    return false;
  }
}

bool OptimizationJobStore::CompleteJobFailure(const std::string& job_id,
                                              const std::string& worker_id,
                                              const OptimizationJobFailureState state,
                                              const SolveRequestOutcome outcome,
                                              const std::uint16_t http_status,
                                              const std::string& error_message) {
  if (!IsConfigured()) {
    return false;
  }

  try {
    const auto result = client_->execSqlSync(
        "update optimization_jobs "
        "set status = $3, "
        "    completed_at = now(), "
        "    updated_at = now(), "
        "    worker_id = null, "
        "    lease_expires_at = null, "
        "    last_heartbeat_at = null, "
        "    expires_at = now() + (($4)::bigint * interval '1 second'), "
        "    outcome = $5, "
        "    http_status = $6, "
        "    error_message = $7, "
        "    result_json = null "
        "where id = $1 and worker_id = $2 and status = 'running'",
        job_id, worker_id, std::string{ToOptimizationJobStateString(state)},
        static_cast<long long>(config_.result_ttl.count()),
        std::string{ToOutcomeString(outcome)}, static_cast<int>(http_status), error_message);
    return result.affectedRows() == 1U;
  } catch (...) {
    return false;
  }
}

bool OptimizationJobStore::TouchWorker(const std::string& worker_id,
                                       const std::optional<std::string>& current_job_id) {
  if (!IsConfigured()) {
    return false;
  }

  try {
    const auto result = client_->execSqlSync(
        "insert into optimization_job_workers(worker_id, current_job_id) "
        "values($1, nullif($2, '')) "
        "on conflict(worker_id) do update "
        "set current_job_id = nullif(excluded.current_job_id, ''), "
        "    last_heartbeat_at = now(), "
        "    updated_at = now()",
        worker_id, current_job_id.value_or(""));
    return result.affectedRows() == 1U;
  } catch (...) {
    return false;
  }
}

bool OptimizationJobStore::ExtendJobLease(const std::string& job_id, const std::string& worker_id) {
  if (!IsConfigured()) {
    return false;
  }

  try {
    const auto result = client_->execSqlSync(
        "update optimization_jobs "
        "set lease_expires_at = now() + (($3)::bigint * interval '1 millisecond'), "
        "    last_heartbeat_at = now(), "
        "    updated_at = now() "
        "where id = $1 and worker_id = $2 and status = 'running'",
        job_id, worker_id, static_cast<long long>(config_.lease_duration.count()));
    return result.affectedRows() == 1U;
  } catch (...) {
    return false;
  }
}

std::size_t OptimizationJobStore::RequeueExpiredRunningJobs() {
  if (!IsConfigured()) {
    return 0U;
  }

  try {
    const auto failed_result = client_->execSqlSync(
        "update optimization_jobs "
        "set status = 'failed', "
        "    worker_id = null, "
        "    completed_at = now(), "
        "    updated_at = now(), "
        "    lease_expires_at = null, "
        "    last_heartbeat_at = null, "
        "    expires_at = now() + (($2)::bigint * interval '1 second'), "
        "    outcome = $3, "
        "    http_status = $4, "
        "    error_message = $5, "
        "    result_json = null "
        "where status = 'running' "
        "  and lease_expires_at is not null "
        "  and lease_expires_at < now() "
        "  and attempt_count >= $1",
        static_cast<long long>(config_.max_attempts),
        static_cast<long long>(config_.result_ttl.count()),
        std::string{ToOutcomeString(SolveRequestOutcome::kFailed)}, 500,
        "Optimization job lease expired too many times.");
    const auto requeued_result = client_->execSqlSync(
        "update optimization_jobs "
        "set status = 'queued', "
        "    worker_id = null, "
        "    started_at = null, "
        "    updated_at = now(), "
        "    lease_expires_at = null, "
        "    last_heartbeat_at = null, "
        "    outcome = null, "
        "    http_status = null, "
        "    error_message = null "
        "where status = 'running' "
        "  and lease_expires_at is not null "
        "  and lease_expires_at < now() "
        "  and attempt_count < $1",
        static_cast<long long>(config_.max_attempts));
    return failed_result.affectedRows() + requeued_result.affectedRows();
  } catch (...) {
    return 0U;
  }
}

std::size_t OptimizationJobStore::ExpireFinishedJobs() {
  if (!IsConfigured()) {
    return 0U;
  }

  try {
    const auto result = client_->execSqlSync(
        "update optimization_jobs "
        "set status = 'expired', "
        "    updated_at = now(), "
        "    result_json = null, "
        "    error_message = null "
        "where status in ('succeeded', 'failed', 'timed_out') "
        "  and expires_at is not null "
        "  and expires_at < now()");
    return result.affectedRows();
  } catch (...) {
    return 0U;
  }
}

std::optional<OptimizationJobRecord> OptimizationJobStore::GetJob(const std::string& job_id) {
  return ReadJobById(job_id);
}

OptimizationJobStoreStats OptimizationJobStore::GetStats() {
  if (!IsConfigured()) {
    return {};
  }

  try {
    const auto result = client_->execSqlSync(
        "select "
        "count(*) filter (where status = 'queued') as queued_jobs, "
        "count(*) filter (where status = 'running') as running_jobs "
        "from optimization_jobs");
    if (result.empty()) {
      return {};
    }

    const auto row = result.front();
    return OptimizationJobStoreStats{
        .queued_jobs = static_cast<std::size_t>(row["queued_jobs"].as<long long>()),
        .running_jobs = static_cast<std::size_t>(row["running_jobs"].as<long long>()),
    };
  } catch (...) {
    return {};
  }
}

std::size_t OptimizationJobStore::CountHealthyWorkers(const std::chrono::milliseconds max_age) {
  if (!IsConfigured()) {
    return 0U;
  }

  try {
    const auto result = client_->execSqlSync(
        "select count(*) as healthy_workers "
        "from optimization_job_workers "
        "where last_heartbeat_at >= now() - (($1)::bigint * interval '1 millisecond')",
        static_cast<long long>(max_age.count()));
    if (result.empty()) {
      return 0U;
    }
    return static_cast<std::size_t>(result.front()["healthy_workers"].as<long long>());
  } catch (...) {
    return 0U;
  }
}

std::optional<OptimizationJobRecord> OptimizationJobStore::ReadJobById(const std::string& job_id) {
  if (!IsConfigured()) {
    return std::nullopt;
  }

  try {
    const auto result = client_->execSqlSync(
        "select id, request_id, status, jobs_count, vehicles_count, "
        "queued_at::text as queued_at, started_at::text as started_at, "
        "completed_at::text as completed_at, expires_at::text as expires_at, "
        "outcome, http_status, error_message, result_json::text as result_json "
        "from optimization_jobs "
        "where id = $1",
        job_id);
    return ReadJobRecord(result);
  } catch (...) {
    return std::nullopt;
  }
}

} // namespace deliveryoptimizer::api
