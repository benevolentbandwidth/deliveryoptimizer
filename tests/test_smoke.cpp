#include "deliveryoptimizer/adapters/routing_facade.hpp"

#include <gtest/gtest.h>

TEST(RoutingFacadeTest, ReturnsOptimizationSummary) {
  const std::string result = deliveryoptimizer::adapters::RoutingFacade::Optimize(5U, 2U);
  const bool has_expected_summary = result.find("optimized-plan") != std::string::npos &&
                                    result.find("deliveries=5") != std::string::npos &&
                                    result.find("vehicles=2") != std::string::npos;

  EXPECT_TRUE(has_expected_summary);
}
