#include "deliveryoptimizer/domain/problem.hpp"

#include <gtest/gtest.h>

TEST(DeliveryProblemTest, NotEmptyWhenInputsPresent) {
  const deliveryoptimizer::domain::DeliveryProblem problem{3U, 2U};
  EXPECT_FALSE(problem.empty());
}
