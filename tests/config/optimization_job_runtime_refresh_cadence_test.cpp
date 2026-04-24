#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <iterator>
#include <string>

namespace fs = std::filesystem;

namespace {

[[nodiscard]] std::string ReadFile(const fs::path& path) {
  std::ifstream file(path);
  EXPECT_TRUE(file.is_open()) << "Unable to read " << path;
  return {std::istreambuf_iterator<char>{file}, std::istreambuf_iterator<char>{}};
}

[[nodiscard]] std::string ExtractFunctionBody(const std::string& content,
                                              const std::string& function_name) {
  const std::size_t signature_pos = content.find(function_name);
  if (signature_pos == std::string::npos) {
    return {};
  }

  const std::size_t body_start = content.find('{', signature_pos);
  if (body_start == std::string::npos) {
    return {};
  }

  std::size_t depth = 0U;
  for (std::size_t index = body_start; index < content.size(); ++index) {
    if (content[index] == '{') {
      ++depth;
    } else if (content[index] == '}') {
      --depth;
      if (depth == 0U) {
        return content.substr(body_start + 1U, index - body_start - 1U);
      }
    }
  }

  return {};
}

} // namespace

TEST(ApiConfigTest, OptimizationJobRuntimeRefreshesIdleStatsOnSweepCadence) {
  const fs::path runtime_path = fs::path(DELIVERYOPTIMIZER_SOURCE_DIR) / "app" / "api" / "src" /
                                "optimization_job_runtime.cpp";
  const std::string content = ReadFile(runtime_path);

  const std::string worker_loop =
      ExtractFunctionBody(content, "void OptimizationJobRuntime::WorkerLoop");
  ASSERT_FALSE(worker_loop.empty());

  const std::size_t idle_branch_pos = worker_loop.find("if (!claimed_job.has_value())");
  ASSERT_NE(idle_branch_pos, std::string::npos);
  const std::size_t idle_continue_pos = worker_loop.find("continue;", idle_branch_pos);
  ASSERT_NE(idle_continue_pos, std::string::npos);
  const std::string idle_branch =
      worker_loop.substr(idle_branch_pos, idle_continue_pos - idle_branch_pos);

  EXPECT_EQ(idle_branch.find("RefreshObservability()"), std::string::npos);

  const std::string heartbeat_loop =
      ExtractFunctionBody(content, "void OptimizationJobRuntime::HeartbeatLoop");
  ASSERT_FALSE(heartbeat_loop.empty());
  EXPECT_EQ(heartbeat_loop.find("RefreshObservability()"), std::string::npos);

  const std::string sweep_loop =
      ExtractFunctionBody(content, "void OptimizationJobRuntime::SweepLoop");
  ASSERT_FALSE(sweep_loop.empty());
  EXPECT_NE(sweep_loop.find("RefreshObservability()"), std::string::npos);
}
