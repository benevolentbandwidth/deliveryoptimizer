#include "deliveryoptimizer/application/optimize_service.hpp"
#include "deliveryoptimizer/domain/problem.hpp"

#include <gtest/gtest.h>

TEST(OptimizeServiceTest, ReturnsOptimizedSummaryWhenInputsValid) {
  const deliveryoptimizer::domain::DeliveryProblem problem{6U, 2U};
  EXPECT_EQ(deliveryoptimizer::application::OptimizeService::Optimize(problem),
            "optimized-plan: deliveries=6, vehicles=2");
}
