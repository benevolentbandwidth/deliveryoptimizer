#include "deliveryoptimizer/api/server_options.hpp"

#include <chrono>
#include <cstdlib>
#include <gtest/gtest.h>
#include <limits>
#include <optional>
#include <string>
#include <utility>

namespace {

class ScopedEnvVar {
public:
  explicit ScopedEnvVar(std::string name) : name_(std::move(name)) {
    if (const char* current_value = std::getenv(name_.c_str()); current_value != nullptr) {
      original_value_ = current_value;
    }
  }

  ~ScopedEnvVar() {
    if (original_value_.has_value()) {
      setenv(name_.c_str(), original_value_->c_str(), 1);
      return;
    }

    unsetenv(name_.c_str());
  }

  ScopedEnvVar(const ScopedEnvVar&) = delete;
  ScopedEnvVar& operator=(const ScopedEnvVar&) = delete;
  ScopedEnvVar(ScopedEnvVar&&) = delete;
  ScopedEnvVar& operator=(ScopedEnvVar&&) = delete;

  void Set(const char* value) const { ASSERT_EQ(setenv(name_.c_str(), value, 1), 0); }

  void Unset() const { ASSERT_EQ(unsetenv(name_.c_str()), 0); }

private:
  std::string name_;
  std::optional<std::string> original_value_;
};

} // namespace

TEST(ServerOptionsTest, InvalidListenPortFallsBackToDefaultAndLogsWarning) {
  ScopedEnvVar listen_port("DELIVERYOPTIMIZER_PORT");
  ScopedEnvVar thread_count("DELIVERYOPTIMIZER_THREADS");
  listen_port.Unset();
  thread_count.Unset();

  const auto baseline_options = deliveryoptimizer::api::LoadServerOptionsFromEnv();

  listen_port.Set("invalid-port");

  testing::internal::CaptureStderr();
  const auto options = deliveryoptimizer::api::LoadServerOptionsFromEnv();
  const std::string stderr_output = testing::internal::GetCapturedStderr();

  EXPECT_EQ(options.listen_port, baseline_options.listen_port);
  EXPECT_EQ(options.worker_threads, baseline_options.worker_threads);
  EXPECT_NE(stderr_output.find("DELIVERYOPTIMIZER_PORT"), std::string::npos);
  EXPECT_NE(stderr_output.find("invalid-port"), std::string::npos);
}

TEST(ServerOptionsTest, InvalidThreadCountFallsBackToDetectedDefaultAndLogsWarning) {
  ScopedEnvVar thread_count("DELIVERYOPTIMIZER_THREADS");
  thread_count.Unset();

  const auto baseline_options = deliveryoptimizer::api::LoadServerOptionsFromEnv();

  thread_count.Set("invalid-thread-count");

  testing::internal::CaptureStderr();
  const auto options = deliveryoptimizer::api::LoadServerOptionsFromEnv();
  const std::string stderr_output = testing::internal::GetCapturedStderr();

  EXPECT_EQ(options.listen_port, baseline_options.listen_port);
  EXPECT_EQ(options.worker_threads, baseline_options.worker_threads);
  EXPECT_NE(stderr_output.find("DELIVERYOPTIMIZER_THREADS"), std::string::npos);
  EXPECT_NE(stderr_output.find("invalid-thread-count"), std::string::npos);
}

TEST(ServerOptionsTest, ExcessiveThreadCountIsCappedAndLogsWarning) {
  ScopedEnvVar thread_count("DELIVERYOPTIMIZER_THREADS");
  thread_count.Set("999");

  testing::internal::CaptureStderr();
  const auto options = deliveryoptimizer::api::LoadServerOptionsFromEnv();
  const std::string stderr_output = testing::internal::GetCapturedStderr();

  EXPECT_EQ(options.worker_threads, 64U);
  EXPECT_NE(stderr_output.find("Capping DELIVERYOPTIMIZER_THREADS"), std::string::npos);
}

TEST(ServerOptionsTest, ReadsSolverAdmissionOptionsFromEnv) {
  ScopedEnvVar enable_metrics("DELIVERYOPTIMIZER_ENABLE_METRICS");
  ScopedEnvVar solver_max_concurrency("DELIVERYOPTIMIZER_SOLVER_MAX_CONCURRENCY");
  ScopedEnvVar solver_max_queue_size("DELIVERYOPTIMIZER_SOLVER_MAX_QUEUE_SIZE");
  ScopedEnvVar solver_queue_wait_ms("DELIVERYOPTIMIZER_SOLVER_QUEUE_WAIT_MS");
  ScopedEnvVar solver_max_sync_jobs("DELIVERYOPTIMIZER_SOLVER_MAX_SYNC_JOBS");
  ScopedEnvVar solver_max_sync_vehicles("DELIVERYOPTIMIZER_SOLVER_MAX_SYNC_VEHICLES");
  enable_metrics.Set("1");
  solver_max_concurrency.Set("3");
  solver_max_queue_size.Set("9");
  solver_queue_wait_ms.Set("2500");
  solver_max_sync_jobs.Set("321");
  solver_max_sync_vehicles.Set("17");

  const auto options = deliveryoptimizer::api::LoadServerOptionsFromEnv();

  EXPECT_TRUE(options.enable_metrics);
  EXPECT_EQ(options.solve_admission.max_concurrency, 3U);
  EXPECT_EQ(options.solve_admission.max_queue_size, 9U);
  EXPECT_EQ(options.solve_admission.max_queue_wait, std::chrono::milliseconds{2500});
  EXPECT_EQ(options.solve_admission.max_sync_jobs, 321U);
  EXPECT_EQ(options.solve_admission.max_sync_vehicles, 17U);
}

TEST(ServerOptionsTest, MetricsAreDisabledByDefault) {
  ScopedEnvVar enable_metrics("DELIVERYOPTIMIZER_ENABLE_METRICS");
  enable_metrics.Unset();

  const auto options = deliveryoptimizer::api::LoadServerOptionsFromEnv();

  EXPECT_FALSE(options.enable_metrics);
}

TEST(ServerOptionsTest, InvalidMetricsFlagFallsBackToDisabledAndLogsWarning) {
  ScopedEnvVar enable_metrics("DELIVERYOPTIMIZER_ENABLE_METRICS");
  enable_metrics.Set("maybe");

  testing::internal::CaptureStderr();
  const auto options = deliveryoptimizer::api::LoadServerOptionsFromEnv();
  const std::string stderr_output = testing::internal::GetCapturedStderr();

  EXPECT_FALSE(options.enable_metrics);
  EXPECT_NE(stderr_output.find("DELIVERYOPTIMIZER_ENABLE_METRICS"), std::string::npos);
}

TEST(ServerOptionsTest, AllowsZeroSolverQueueWaitTimeoutFromEnv) {
  ScopedEnvVar solver_queue_wait_ms("DELIVERYOPTIMIZER_SOLVER_QUEUE_WAIT_MS");
  solver_queue_wait_ms.Set("0");

  const auto options = deliveryoptimizer::api::LoadServerOptionsFromEnv();

  EXPECT_EQ(options.solve_admission.max_queue_wait, std::chrono::milliseconds{0});
}

TEST(ServerOptionsTest, ClampsSolverMaxConcurrencyToSupportedCap) {
  ScopedEnvVar solver_max_concurrency("DELIVERYOPTIMIZER_SOLVER_MAX_CONCURRENCY");
  solver_max_concurrency.Set("999");

  testing::internal::CaptureStderr();
  const auto options = deliveryoptimizer::api::LoadServerOptionsFromEnv();
  const std::string stderr_output = testing::internal::GetCapturedStderr();

  EXPECT_EQ(options.solve_admission.max_concurrency, 64U);
  EXPECT_NE(stderr_output.find("DELIVERYOPTIMIZER_SOLVER_MAX_CONCURRENCY"), std::string::npos);
}

TEST(ServerOptionsTest, ClampsSolverQueueWaitTimeoutToRepresentableRange) {
  ScopedEnvVar solver_queue_wait_ms("DELIVERYOPTIMIZER_SOLVER_QUEUE_WAIT_MS");
  const auto overflowing_timeout_ms = std::to_string(
      static_cast<unsigned long long>(std::numeric_limits<std::chrono::milliseconds::rep>::max()) +
      1ULL);
  solver_queue_wait_ms.Set(overflowing_timeout_ms.c_str());

  testing::internal::CaptureStderr();
  const auto options = deliveryoptimizer::api::LoadServerOptionsFromEnv();
  const std::string stderr_output = testing::internal::GetCapturedStderr();
  const auto expected_timeout = std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::steady_clock::duration::max());

  EXPECT_EQ(options.solve_admission.max_queue_wait, expected_timeout);
  EXPECT_NE(stderr_output.find("DELIVERYOPTIMIZER_SOLVER_QUEUE_WAIT_MS"), std::string::npos);
}

TEST(ServerOptionsTest, ClampsSolverAdmissionSyncLimitsToSupportedParserCaps) {
  ScopedEnvVar solver_max_sync_jobs("DELIVERYOPTIMIZER_SOLVER_MAX_SYNC_JOBS");
  ScopedEnvVar solver_max_sync_vehicles("DELIVERYOPTIMIZER_SOLVER_MAX_SYNC_VEHICLES");
  solver_max_sync_jobs.Set("20000");
  solver_max_sync_vehicles.Set("5000");

  testing::internal::CaptureStderr();
  const auto options = deliveryoptimizer::api::LoadServerOptionsFromEnv();
  const std::string stderr_output = testing::internal::GetCapturedStderr();

  EXPECT_EQ(options.solve_admission.max_sync_jobs, 10000U);
  EXPECT_EQ(options.solve_admission.max_sync_vehicles, 2000U);
  EXPECT_NE(stderr_output.find("DELIVERYOPTIMIZER_SOLVER_MAX_SYNC_JOBS"), std::string::npos);
  EXPECT_NE(stderr_output.find("DELIVERYOPTIMIZER_SOLVER_MAX_SYNC_VEHICLES"), std::string::npos);
}
