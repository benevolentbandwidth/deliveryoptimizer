#include "deliveryoptimizer/api/server_options.hpp"

#include <cstdlib>
#include <gtest/gtest.h>
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
