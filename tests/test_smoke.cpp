#include "deliveryoptimizer/adapters/routing_facade.hpp"

#include <gtest/gtest.h>

TEST(RoutingFacadeTest, ReturnsOptimizationSummary) {
  const deliveryoptimizer::adapters::RoutingFacade facade;
  const std::string result = facade.Optimize(5, 2);

  EXPECT_NE(result.find("optimized-plan"), std::string::npos);
  EXPECT_NE(result.find("deliveries=5"), std::string::npos);
  EXPECT_NE(result.find("vehicles=2"), std::string::npos);
}
