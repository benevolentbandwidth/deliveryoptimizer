#include "deliveryoptimizer/application/optimize_service.hpp"
#include "deliveryoptimizer/domain/problem.hpp"

#include <gtest/gtest.h>

TEST(OptimizeServiceTest, ReturnsNoPlanWhenDeliveriesMissing) {
  const deliveryoptimizer::domain::DeliveryProblem problem{0U, 1U};
  EXPECT_EQ(deliveryoptimizer::application::Optimize(problem),
            "no-plan: deliveries=0 or vehicles=0");
}
