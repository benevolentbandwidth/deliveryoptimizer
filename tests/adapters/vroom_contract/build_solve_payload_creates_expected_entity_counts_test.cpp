#include "deliveryoptimizer/adapters/vroom_contract.hpp"

#include <gtest/gtest.h>
#include <json/json.h>
#include <memory>
#include <string_view>

namespace {

Json::Value ParseJsonOrDie(const std::string_view input) {
  Json::CharReaderBuilder builder;
  builder["collectComments"] = false;

  Json::Value root;
  JSONCPP_STRING errors;
  std::unique_ptr<Json::CharReader> reader{builder.newCharReader()};

  const auto* begin = input.data();
  const auto* end = begin + input.size();
  const bool parsed = reader->parse(begin, end, &root, &errors);
  EXPECT_TRUE(parsed) << errors;
  return root;
}

} // namespace

TEST(VroomContractTest, BuildSolvePayloadCreatesExpectedEntityCounts) {
  const std::string payload = deliveryoptimizer::adapters::BuildSolvePayload(3U, 2U);
  const Json::Value root = ParseJsonOrDie(payload);

  ASSERT_TRUE(root["jobs"].isArray());
  ASSERT_TRUE(root["vehicles"].isArray());
  EXPECT_EQ(root["jobs"].size(), 3U);
  EXPECT_EQ(root["vehicles"].size(), 2U);
  EXPECT_EQ(root["jobs"][0]["id"].asUInt64(), 1U);
  EXPECT_EQ(root["vehicles"][0]["id"].asUInt64(), 1U);
}
