#include "deliveryoptimizer/adapters/routing_facade.hpp"

#include <gtest/gtest.h>

TEST(RoutingFacadeTest, ReturnsNoPlanWhenVehiclesMissing) {
  EXPECT_EQ(deliveryoptimizer::adapters::Optimize(3U, 0U), "no-plan: deliveries=0 or vehicles=0");
}
