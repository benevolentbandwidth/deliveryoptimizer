#include "deliveryoptimizer/adapters/osrm_contract.hpp"

#include <gtest/gtest.h>
#include <vector>

TEST(OsrmContractTest, TablePathRequiresAtLeastTwoCoordinates) {
  const std::vector<deliveryoptimizer::adapters::Coordinate> single_coordinate{
      {.lon = 7.4236, .lat = 43.7384}};

  EXPECT_TRUE(deliveryoptimizer::adapters::BuildTablePath(single_coordinate).empty());
}
