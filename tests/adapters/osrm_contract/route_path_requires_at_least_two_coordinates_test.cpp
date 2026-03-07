#include "deliveryoptimizer/adapters/osrm_contract.hpp"

#include <gtest/gtest.h>
#include <vector>

TEST(OsrmContractTest, RoutePathRequiresAtLeastTwoCoordinates) {
  const std::vector<deliveryoptimizer::adapters::Coordinate> single_coordinate{
      {.lon = 7.4236, .lat = 43.7384}};

  EXPECT_TRUE(deliveryoptimizer::adapters::OsrmContract::BuildRoutePath(single_coordinate).empty());
}
