#include "deliveryoptimizer/application/optimize_service.hpp"
#include "deliveryoptimizer/domain/problem.hpp"

#include <gtest/gtest.h>

TEST(OptimizeServiceTest, ReturnsNoPlanWhenVehiclesMissing) {
  const deliveryoptimizer::domain::DeliveryProblem problem{4U, 0U};
  EXPECT_EQ(deliveryoptimizer::application::OptimizeService::Optimize(problem),
            "no-plan: deliveries=0 or vehicles=0");
}
