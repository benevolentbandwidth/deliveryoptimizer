#include "deliveryoptimizer/adapters/vroom_contract.hpp"

#include <gtest/gtest.h>
#include <string_view>

TEST(VroomContractTest, ParseSolveSummaryReturnsNulloptWhenSummaryIsMissing) {
  constexpr std::string_view missing_summary = R"json({"status":"ok"})json";
  EXPECT_FALSE(deliveryoptimizer::adapters::ParseSolveSummary(missing_summary).has_value());
}
