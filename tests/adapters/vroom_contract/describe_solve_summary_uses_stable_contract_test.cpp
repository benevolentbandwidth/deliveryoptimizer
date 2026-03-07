#include "deliveryoptimizer/adapters/vroom_contract.hpp"

#include <gtest/gtest.h>

TEST(VroomContractTest, DescribeSolveSummaryUsesStableContract) {
  const deliveryoptimizer::adapters::VroomSolveSummary summary{.routes = 4U, .unassigned = 1U};
  EXPECT_EQ(deliveryoptimizer::adapters::VroomContract::DescribeSolveSummary(summary),
            "routes=4, unassigned=1");
}
