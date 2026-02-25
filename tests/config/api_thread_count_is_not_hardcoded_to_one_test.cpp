#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <iterator>
#include <regex>
#include <string>

namespace fs = std::filesystem;

TEST(ApiConfigTest, ThreadCountIsNotHardcodedToOne) {
  const fs::path main_path =
      fs::path(DELIVERYOPTIMIZER_SOURCE_DIR) / "app" / "api" / "src" / "main.cpp";
  std::ifstream file(main_path);
  ASSERT_TRUE(file.is_open()) << "Unable to read " << main_path;

  const std::string content{std::istreambuf_iterator<char>{file}, std::istreambuf_iterator<char>{}};
  const std::regex hardcoded_single_thread_pattern{R"(setThreadNum\s*\(\s*1\s*\))"};

  EXPECT_FALSE(std::regex_search(content, hardcoded_single_thread_pattern));
}
