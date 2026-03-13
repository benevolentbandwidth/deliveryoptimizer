#include "deliveryoptimizer/adapters/routing_facade.hpp"

#include <gtest/gtest.h>

TEST(RoutingFacadeTest, ReturnsNoPlanWhenDeliveriesMissing) {
  EXPECT_EQ(deliveryoptimizer::adapters::Optimize(0U, 3U), "no-plan: deliveries=0 or vehicles=0");
}
