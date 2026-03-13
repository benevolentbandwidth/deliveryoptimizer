#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <iterator>
#include <string>

namespace fs = std::filesystem;

TEST(BuildConfigTest, DevPresetDoesNotHardcodeDrogonDir) {
  const fs::path presets_path = fs::path(DELIVERYOPTIMIZER_SOURCE_DIR) / "CMakePresets.json";
  std::ifstream file(presets_path);
  ASSERT_TRUE(file.is_open()) << "Unable to read " << presets_path;

  const std::string content{std::istreambuf_iterator<char>{file}, std::istreambuf_iterator<char>{}};

  EXPECT_EQ(content.find("\"Drogon_DIR\""), std::string::npos);
  EXPECT_EQ(content.find("/usr/lib/x86_64-linux-gnu/cmake/Drogon"), std::string::npos);
}
