#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <iterator>
#include <regex>
#include <string>

namespace fs = std::filesystem;

TEST(BuildConfigTest, DeliveryoptimizerTestsTargetAvoidsRedundantTransitiveLinks) {
  const fs::path cmake_path = fs::path(DELIVERYOPTIMIZER_SOURCE_DIR) / "tests" / "CMakeLists.txt";
  std::ifstream file(cmake_path);
  ASSERT_TRUE(file.is_open()) << "Unable to read " << cmake_path;

  const std::string content{std::istreambuf_iterator<char>{file}, std::istreambuf_iterator<char>{}};
  const std::regex link_block_pattern{
      R"(target_link_libraries\s*\(\s*deliveryoptimizer_tests\b([\s\S]*?)\))"};

  std::smatch match;
  ASSERT_TRUE(std::regex_search(content, match, link_block_pattern))
      << "Unable to locate target_link_libraries block for deliveryoptimizer_tests";

  const std::string block = match.str(1);
  EXPECT_NE(block.find("deliveryoptimizer::adapters"), std::string::npos);
  EXPECT_EQ(block.find("deliveryoptimizer::application"), std::string::npos);
  EXPECT_EQ(block.find("deliveryoptimizer::domain"), std::string::npos);
}
