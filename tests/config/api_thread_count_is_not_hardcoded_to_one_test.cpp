#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <iterator>
#include <regex>
#include <string>

namespace fs = std::filesystem;

TEST(ApiConfigTest, ThreadCountIsNotHardcodedToOne) {
  const fs::path api_src_dir = fs::path(DELIVERYOPTIMIZER_SOURCE_DIR) / "app" / "api" / "src";
  ASSERT_TRUE(fs::exists(api_src_dir)) << "Unable to locate " << api_src_dir;
  ASSERT_TRUE(fs::is_directory(api_src_dir)) << "Expected directory: " << api_src_dir;

  const std::regex hardcoded_single_thread_pattern{R"(setThreadNum\s*\(\s*1\s*\))"};
  bool discovered_source = false;

  for (const auto& entry : fs::recursive_directory_iterator(api_src_dir)) {
    if (!entry.is_regular_file() || entry.path().extension() != ".cpp") {
      continue;
    }

    discovered_source = true;

    std::ifstream file(entry.path());
    ASSERT_TRUE(file.is_open()) << "Unable to read " << entry.path();

    const std::string content{std::istreambuf_iterator<char>{file},
                              std::istreambuf_iterator<char>{}};
    EXPECT_FALSE(std::regex_search(content, hardcoded_single_thread_pattern))
        << "Found hardcoded single-thread configuration in " << entry.path();
  }

  EXPECT_TRUE(discovered_source) << "No API source files discovered in " << api_src_dir;
}
