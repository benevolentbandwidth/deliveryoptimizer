#include "deliveryoptimizer/api/observability.hpp"

#include <array>
#include <chrono>
#include <gtest/gtest.h>
#include <string>

namespace {

deliveryoptimizer::api::SolveLifecycle BuildLifecycle(const std::string& request_id) {
  const auto completed_at = std::chrono::steady_clock::now();
  deliveryoptimizer::api::SolveLifecycle lifecycle{};
  lifecycle.request_id = request_id;
  lifecycle.method = "POST";
  lifecycle.path = "/api/v1/deliveries/optimize";
  lifecycle.jobs = 1U;
  lifecycle.vehicles = 1U;
  lifecycle.request_started_at = completed_at;
  lifecycle.completed_at = completed_at;
  return lifecycle;
}

} // namespace

TEST(ObservabilityRegistryTest, RendersPrometheusMetricsWithExpectedFamiliesAndBuckets) {
  deliveryoptimizer::api::ObservabilityRegistry registry;
  registry.RecordAccepted();
  registry.RecordSucceeded();
  registry.RecordRejected();
  registry.RecordTimedOut();
  registry.RecordFailed();
  registry.SetSolverState(2U, 1U);
  registry.SetAsyncJobState(3U, 1U, 2U);
  registry.ObserveQueueWait(std::chrono::milliseconds{250});
  registry.ObserveSolveDuration(std::chrono::milliseconds{500});
  registry.ObserveRequestDuration(std::chrono::milliseconds{1500});

  const std::string rendered = registry.RenderPrometheusText();

  EXPECT_NE(rendered.find("# HELP deliveryoptimizer_solver_requests_accepted_total Count of solver "
                          "requests accepted into the coordinator queue."),
            std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_requests_accepted_total 1"), std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_requests_succeeded_total 1"),
            std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_requests_rejected_total 1"), std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_requests_timed_out_total 1"),
            std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_requests_failed_total 1"), std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_request_tracker_write_failures_total 0"),
            std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_queue_depth 2"), std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_inflight 1"), std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_async_job_queue_depth 3"), std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_async_job_running 1"), std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_async_job_workers_healthy 2"),
            std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_queue_wait_seconds_bucket{le=\"0.25\"} 1"),
            std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_queue_wait_seconds_bucket{le=\"+Inf\"} 1"),
            std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_queue_wait_seconds_sum 0.25"),
            std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_queue_wait_seconds_count 1"),
            std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_duration_seconds_sum 0.5"), std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_request_duration_seconds_sum 1.5"),
            std::string::npos);
}

TEST(ObservabilityRegistryTest, DropsPendingLogLinesWhenAsyncQueueIsFull) {
  deliveryoptimizer::api::ObservabilityRegistry registry(
      deliveryoptimizer::api::ObservabilityOptions{
          .max_pending_log_lines = 2U,
          .start_log_writer = false,
      });

  registry.LogSolveRequest(BuildLifecycle("request-1"),
                           deliveryoptimizer::api::SolveRequestOutcome::kSucceeded, 200);
  registry.LogSolveRequest(BuildLifecycle("request-2"),
                           deliveryoptimizer::api::SolveRequestOutcome::kSucceeded, 200);
  registry.LogSolveRequest(BuildLifecycle("request-3"),
                           deliveryoptimizer::api::SolveRequestOutcome::kSucceeded, 200);
  registry.LogSolveRequest(BuildLifecycle("request-4"),
                           deliveryoptimizer::api::SolveRequestOutcome::kSucceeded, 200);
  registry.LogSolveRequest(BuildLifecycle("request-5"),
                           deliveryoptimizer::api::SolveRequestOutcome::kSucceeded, 200);

  const std::string rendered = registry.RenderPrometheusText();

  EXPECT_NE(rendered.find("deliveryoptimizer_request_tracker_write_failures_total 3"),
            std::string::npos);
}

TEST(ObservabilityRegistryTest, FinalizeSuccessfulAcceptedRequestIncrementsSucceededCounter) {
  auto observability = std::make_shared<deliveryoptimizer::api::ObservabilityRegistry>();
  auto lifecycle =
      std::make_shared<deliveryoptimizer::api::SolveLifecycle>(BuildLifecycle("request-success"));
  lifecycle->accepted = true;

  deliveryoptimizer::api::FinalizeSolveRequest(
      observability, lifecycle, deliveryoptimizer::api::SolveRequestOutcome::kSucceeded, 200);

  const std::string rendered = observability->RenderPrometheusText();

  EXPECT_NE(rendered.find("deliveryoptimizer_solver_requests_succeeded_total 1"),
            std::string::npos);
}

TEST(ObservabilityRegistryTest, FinalizeAsyncAcceptanceDoesNotIncrementSucceededCounter) {
  auto observability = std::make_shared<deliveryoptimizer::api::ObservabilityRegistry>();
  auto lifecycle =
      std::make_shared<deliveryoptimizer::api::SolveLifecycle>(BuildLifecycle("request-async"));

  deliveryoptimizer::api::FinalizeSolveRequest(
      observability, lifecycle, deliveryoptimizer::api::SolveRequestOutcome::kAcceptedAsync, 202);

  const std::string rendered = observability->RenderPrometheusText();

  EXPECT_NE(rendered.find("deliveryoptimizer_solver_requests_succeeded_total 0"),
            std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_requests_rejected_total 0"),
            std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_requests_failed_total 0"),
            std::string::npos);
}

TEST(ObservabilityRegistryTest, AsyncJobCompletionIncrementsSucceededCounter) {
  deliveryoptimizer::api::ObservabilityRegistry registry;

  registry.RecordAsyncJobCompletion(deliveryoptimizer::api::SolveRequestOutcome::kSucceeded);

  const std::string rendered = registry.RenderPrometheusText();

  EXPECT_NE(rendered.find("deliveryoptimizer_solver_requests_succeeded_total 1"),
            std::string::npos);
}

TEST(ObservabilityRegistryTest, FinalizeClientErrorsIncrementRejectedCounter) {
  constexpr std::array client_error_outcomes{
      deliveryoptimizer::api::SolveRequestOutcome::kInvalidJson,
      deliveryoptimizer::api::SolveRequestOutcome::kValidationFailed,
      deliveryoptimizer::api::SolveRequestOutcome::kRequestTooLarge,
  };

  auto observability = std::make_shared<deliveryoptimizer::api::ObservabilityRegistry>();
  for (std::size_t index = 0; index < client_error_outcomes.size(); ++index) {
    auto lifecycle = std::make_shared<deliveryoptimizer::api::SolveLifecycle>(
        BuildLifecycle("request-client-error-" + std::to_string(index)));
    deliveryoptimizer::api::FinalizeSolveRequest(observability, lifecycle,
                                                 client_error_outcomes[index], 400);
  }

  const std::string rendered = observability->RenderPrometheusText();

  EXPECT_NE(rendered.find("deliveryoptimizer_solver_requests_rejected_total 3"), std::string::npos);
}
