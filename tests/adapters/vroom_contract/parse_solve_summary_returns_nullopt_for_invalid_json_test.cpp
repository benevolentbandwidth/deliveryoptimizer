#include "deliveryoptimizer/adapters/vroom_contract.hpp"

#include <gtest/gtest.h>
#include <string_view>

TEST(VroomContractTest, ParseSolveSummaryReturnsNulloptForInvalidJson) {
  constexpr std::string_view invalid = "{summary: [";
  EXPECT_FALSE(deliveryoptimizer::adapters::VroomContract::ParseSolveSummary(invalid).has_value());
}
