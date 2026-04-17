#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <iterator>
#include <string>

namespace fs = std::filesystem;

TEST(DeployConfigTest, OsrmComposeKeepsOsrmInternalOnly) {
  const fs::path compose_path =
      fs::path(DELIVERYOPTIMIZER_SOURCE_DIR) / "deploy" / "compose" / "docker-compose.arm64.yml";
  std::ifstream file(compose_path);
  ASSERT_TRUE(file.is_open()) << "Unable to read " << compose_path;

  const std::string content{std::istreambuf_iterator<char>{file}, std::istreambuf_iterator<char>{}};
  const auto osrm_block_start = content.find("  osrm:\n");
  ASSERT_NE(osrm_block_start, std::string::npos);

  const auto http_server_block_start = content.find("\n  http-server:\n", osrm_block_start);
  ASSERT_NE(http_server_block_start, std::string::npos);

  const std::string osrm_block =
      content.substr(osrm_block_start, http_server_block_start - osrm_block_start);

  EXPECT_NE(content.find("OSRM_PORT: ${OSRM_INTERNAL_PORT:-5001}"), std::string::npos);
  EXPECT_EQ(content.find("DELIVERYOPTIMIZER_OSRM_HOST_PORT"), std::string::npos);
  EXPECT_NE(content.find("http://127.0.0.1:${OSRM_INTERNAL_PORT:-5001}/nearest"),
            std::string::npos);
  EXPECT_EQ(osrm_block.find("\n    ports:\n"), std::string::npos);
}
