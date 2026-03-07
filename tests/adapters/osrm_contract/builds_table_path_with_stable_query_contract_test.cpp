#include "deliveryoptimizer/adapters/osrm_contract.hpp"

#include <gtest/gtest.h>
#include <vector>

TEST(OsrmContractTest, BuildsTablePathWithStableQueryContract) {
  const std::vector<deliveryoptimizer::adapters::Coordinate> coordinates{
      {.lon = 7.4236, .lat = 43.7384}, {.lon = 7.4212, .lat = 43.7308}};

  EXPECT_EQ(
      deliveryoptimizer::adapters::OsrmContract::BuildTablePath(coordinates),
      "/table/v1/driving/7.423600,43.738400;7.421200,43.730800?annotations=distance,duration");
}
