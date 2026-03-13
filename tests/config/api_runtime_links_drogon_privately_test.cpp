#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <iterator>
#include <regex>
#include <string>

namespace fs = std::filesystem;

TEST(BuildConfigTest, ApiRuntimeLinksDrogonPrivately) {
  const fs::path cmake_path =
      fs::path(DELIVERYOPTIMIZER_SOURCE_DIR) / "app" / "api" / "CMakeLists.txt";
  std::ifstream file(cmake_path);
  ASSERT_TRUE(file.is_open()) << "Unable to read " << cmake_path;

  const std::string content{std::istreambuf_iterator<char>{file}, std::istreambuf_iterator<char>{}};
  const std::regex link_block_pattern{
      R"(target_link_libraries\s*\(\s*deliveryoptimizer_api_runtime\b([\s\S]*?)\))"};

  std::smatch match;
  ASSERT_TRUE(std::regex_search(content, match, link_block_pattern))
      << "Unable to locate target_link_libraries block for deliveryoptimizer_api_runtime";

  const std::string block = match.str(1);

  const std::regex public_section_pattern{R"(PUBLIC([\s\S]*?)PRIVATE)"};
  ASSERT_TRUE(std::regex_search(block, match, public_section_pattern))
      << "Unable to locate PUBLIC section in deliveryoptimizer_api_runtime link block";
  const std::string public_section = match.str(1);
  EXPECT_NE(public_section.find("deliveryoptimizer::adapters"), std::string::npos);
  EXPECT_EQ(public_section.find("Drogon::Drogon"), std::string::npos);

  const std::regex private_section_pattern{R"(PRIVATE([\s\S]*))"};
  ASSERT_TRUE(std::regex_search(block, match, private_section_pattern))
      << "Unable to locate PRIVATE section in deliveryoptimizer_api_runtime link block";
  const std::string private_section = match.str(1);
  EXPECT_NE(private_section.find("Drogon::Drogon"), std::string::npos);
}
