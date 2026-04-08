#include "deliveryoptimizer/api/observability.hpp"

#include <chrono>
#include <gtest/gtest.h>
#include <string>

namespace {

deliveryoptimizer::api::SolveLifecycle BuildLifecycle(const std::string& request_id) {
  const auto completed_at = std::chrono::steady_clock::now();
  return deliveryoptimizer::api::SolveLifecycle{
      .request_id = request_id,
      .method = "POST",
      .path = "/api/v1/deliveries/optimize",
      .jobs = 1U,
      .vehicles = 1U,
      .request_started_at = completed_at,
      .completed_at = completed_at,
  };
}

} // namespace

TEST(ObservabilityRegistryTest, RendersPrometheusMetricsWithExpectedFamiliesAndBuckets) {
  deliveryoptimizer::api::ObservabilityRegistry registry;
  registry.RecordAccepted();
  registry.RecordRejected();
  registry.RecordTimedOut();
  registry.RecordFailed();
  registry.SetSolverState(2U, 1U);
  registry.ObserveQueueWait(std::chrono::milliseconds{250});
  registry.ObserveSolveDuration(std::chrono::milliseconds{500});
  registry.ObserveRequestDuration(std::chrono::milliseconds{1500});

  const std::string rendered = registry.RenderPrometheusText();

  EXPECT_NE(rendered.find("# HELP deliveryoptimizer_solver_requests_accepted_total"), std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_requests_accepted_total 1"), std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_requests_rejected_total 1"), std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_requests_timed_out_total 1"), std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_requests_failed_total 1"), std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_request_tracker_write_failures_total 0"),
            std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_queue_depth 2"), std::string::npos);
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_inflight 1"), std::string::npos);
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
