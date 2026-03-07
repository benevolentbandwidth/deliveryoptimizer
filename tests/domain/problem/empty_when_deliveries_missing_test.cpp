#include "deliveryoptimizer/domain/problem.hpp"

#include <gtest/gtest.h>

TEST(DeliveryProblemTest, EmptyWhenDeliveriesMissing) {
  const deliveryoptimizer::domain::DeliveryProblem problem{0U, 2U};
  EXPECT_TRUE(problem.empty());
}
