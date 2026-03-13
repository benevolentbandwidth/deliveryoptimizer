#include "deliveryoptimizer/adapters/routing_facade.hpp"

#include <gtest/gtest.h>

TEST(RoutingFacadeTest, ReturnsOptimizedPlanForValidInputs) {
  EXPECT_EQ(deliveryoptimizer::adapters::Optimize(5U, 2U),
            "optimized-plan: deliveries=5, vehicles=2");
}
