#include "deliveryoptimizer/adapters/vroom_contract.hpp"

#include <gtest/gtest.h>
#include <string_view>

TEST(VroomContractTest, ParseSolveSummaryReadsRoutesAndUnassigned) {
  constexpr std::string_view response = R"json(
{
  "status": "ok",
  "summary": {
    "routes": 2,
    "unassigned": 1
  }
}
)json";

  const auto summary = deliveryoptimizer::adapters::ParseSolveSummary(response);
  ASSERT_TRUE(summary.has_value());
  EXPECT_EQ(summary->routes, 2U);
  EXPECT_EQ(summary->unassigned, 1U);
}
