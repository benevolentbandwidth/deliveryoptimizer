#include <cctype>
#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <iterator>
#include <sstream>
#include <string>

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

}  // namespace

TEST(DeployConfigTest, OsrmComposeKeepsOsrmInternalOnly) {
  const fs::path compose_path =
      fs::path(DELIVERYOPTIMIZER_SOURCE_DIR) / "deploy" / "compose" / "docker-compose.arm64.yml";
  std::ifstream file(compose_path);
  ASSERT_TRUE(file.is_open()) << "Unable to read " << compose_path;

  const std::string content{std::istreambuf_iterator<char>{file}, std::istreambuf_iterator<char>{}};
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
