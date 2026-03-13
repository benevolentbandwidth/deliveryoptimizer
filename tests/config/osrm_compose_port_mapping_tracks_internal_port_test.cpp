#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <iterator>
#include <string>

namespace fs = std::filesystem;

TEST(DeployConfigTest, OsrmComposePortMappingTracksInternalPort) {
  const fs::path compose_path =
      fs::path(DELIVERYOPTIMIZER_SOURCE_DIR) / "deploy" / "compose" / "docker-compose.arm64.yml";
  std::ifstream file(compose_path);
  ASSERT_TRUE(file.is_open()) << "Unable to read " << compose_path;

  const std::string content{std::istreambuf_iterator<char>{file}, std::istreambuf_iterator<char>{}};

  EXPECT_NE(content.find("OSRM_PORT: ${OSRM_INTERNAL_PORT:-5001}"), std::string::npos);
  EXPECT_NE(
      content.find("\"${DELIVERYOPTIMIZER_OSRM_HOST_PORT:-5001}:${OSRM_INTERNAL_PORT:-5001}\""),
      std::string::npos);
  EXPECT_NE(content.find("http://127.0.0.1:${OSRM_INTERNAL_PORT:-5001}/nearest"),
            std::string::npos);
  EXPECT_EQ(content.find("\"${DELIVERYOPTIMIZER_OSRM_HOST_PORT:-5001}:5001\""), std::string::npos);
}
