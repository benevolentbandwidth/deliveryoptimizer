#include "deliveryoptimizer/api/observability.hpp"

#include <chrono>
#include <gtest/gtest.h>
#include <string>

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
