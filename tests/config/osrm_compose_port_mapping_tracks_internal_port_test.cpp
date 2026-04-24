#include <array>
#include <cctype>
#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <iterator>
#include <sstream>
#include <string>
#include <utility>

namespace fs = std::filesystem;

namespace {

bool IsTopLevelServiceHeader(const std::string& line) {
  if (line.rfind("  ", 0) != 0 || line.size() <= 3U || line.back() != ':') {
    return false;
  }

  for (std::size_t index = 2; index + 1 < line.size(); ++index) {
    const unsigned char ch = static_cast<unsigned char>(line[index]);
    if (!std::isalnum(ch) && ch != '_' && ch != '-') {
      return false;
    }
  }

  return true;
}

[[nodiscard]] std::string ReadFile(const fs::path& path) {
  std::ifstream file(path);
  EXPECT_TRUE(file.is_open()) << "Unable to read " << path;
  return {std::istreambuf_iterator<char>{file}, std::istreambuf_iterator<char>{}};
}

} // namespace

TEST(DeployConfigTest, OsrmComposeKeepsOsrmInternalOnly) {
  const fs::path compose_path =
      fs::path(DELIVERYOPTIMIZER_SOURCE_DIR) / "deploy" / "compose" / "docker-compose.arm64.yml";
  const std::string content = ReadFile(compose_path);
  std::istringstream stream{content};
  bool found_osrm_service = false;
  bool osrm_declares_ports = false;
  bool in_osrm_block = false;
  std::string line;
  while (std::getline(stream, line)) {
    if (!found_osrm_service && line == "  osrm:") {
      found_osrm_service = true;
      in_osrm_block = true;
      continue;
    }

    if (!in_osrm_block) {
      continue;
    }

    if (IsTopLevelServiceHeader(line)) {
      in_osrm_block = false;
      continue;
    }

    if (line == "    ports:") {
      osrm_declares_ports = true;
      break;
    }
  }

  ASSERT_TRUE(found_osrm_service);
  EXPECT_NE(content.find("OSRM_PORT: ${OSRM_INTERNAL_PORT:-5001}"), std::string::npos);
  EXPECT_EQ(content.find("DELIVERYOPTIMIZER_OSRM_HOST_PORT"), std::string::npos);
  EXPECT_NE(content.find("http://127.0.0.1:${OSRM_INTERNAL_PORT:-5001}/nearest"),
            std::string::npos);
  EXPECT_FALSE(osrm_declares_ports);
}

TEST(DeployConfigTest, ComposePassesAsyncJobEnvOverrides) {
  const fs::path source_dir = fs::path(DELIVERYOPTIMIZER_SOURCE_DIR);
  const std::string compose_content =
      ReadFile(source_dir / "deploy" / "compose" / "docker-compose.arm64.yml");
  const std::string env_content = ReadFile(source_dir / "deploy" / "env" / "http-server.arm64.env");

  constexpr std::array expected_job_env{
      std::pair{"DELIVERYOPTIMIZER_JOB_DB_CONNECTIONS", "4"},
      std::pair{"DELIVERYOPTIMIZER_JOB_WORKERS", "2"},
      std::pair{"DELIVERYOPTIMIZER_JOB_MAX_QUEUE_SIZE", "8"},
      std::pair{"DELIVERYOPTIMIZER_JOB_MAX_ATTEMPTS", "3"},
      std::pair{"DELIVERYOPTIMIZER_JOB_POLL_MS", "250"},
      std::pair{"DELIVERYOPTIMIZER_JOB_HEARTBEAT_MS", "1000"},
      std::pair{"DELIVERYOPTIMIZER_JOB_SWEEP_MS", "1000"},
      std::pair{"DELIVERYOPTIMIZER_JOB_LEASE_MS", "90000"},
      std::pair{"DELIVERYOPTIMIZER_JOB_RESULT_TTL_SECONDS", "86400"},
      std::pair{"DELIVERYOPTIMIZER_JOB_WORKER_HEALTH_MS", "5000"},
  };

  for (const auto& [name, default_value] : expected_job_env) {
    const std::string env_assignment = std::string{name} + "=" + default_value;
    const std::string compose_assignment =
        std::string{name} + ": ${" + name + ":-" + default_value + "}";

    EXPECT_NE(env_content.find(env_assignment), std::string::npos)
        << "Missing env default: " << env_assignment;
    EXPECT_NE(compose_content.find(compose_assignment), std::string::npos)
        << "Missing compose pass-through: " << compose_assignment;
  }
}
