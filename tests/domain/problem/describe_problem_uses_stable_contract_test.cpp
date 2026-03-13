#include "deliveryoptimizer/domain/problem.hpp"

#include <gtest/gtest.h>

TEST(DeliveryProblemTest, DescribeProblemUsesStableContract) {
  const deliveryoptimizer::domain::DeliveryProblem problem{5U, 7U};
  EXPECT_EQ(deliveryoptimizer::domain::DescribeProblem(problem), "deliveries=5, vehicles=7");
}
