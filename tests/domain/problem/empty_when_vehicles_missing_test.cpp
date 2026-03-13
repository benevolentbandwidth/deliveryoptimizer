#include "deliveryoptimizer/domain/problem.hpp"

#include <gtest/gtest.h>

TEST(DeliveryProblemTest, EmptyWhenVehiclesMissing) {
  const deliveryoptimizer::domain::DeliveryProblem problem{3U, 0U};
  EXPECT_TRUE(problem.empty());
}
