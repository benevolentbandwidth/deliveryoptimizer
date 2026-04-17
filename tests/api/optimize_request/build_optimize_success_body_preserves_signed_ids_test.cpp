#include "deliveryoptimizer/api/optimize_request.hpp"

#include <gtest/gtest.h>
#include <json/json.h>

namespace {

TEST(OptimizeRequestTest, BuildOptimizeSuccessBodyPreservesExternalIdsForSignedPositiveIds) {
  const deliveryoptimizer::api::OptimizeRequestInput input{
      .depot_lon = 7.4236,
      .depot_lat = 43.7384,
      .vehicles =
          {
              deliveryoptimizer::api::VehicleInput{
                  .external_id = "van-1",
                  .capacity = 8,
                  .start = std::nullopt,
                  .end = std::nullopt,
                  .time_window = std::nullopt,
              },
          },
      .jobs =
          {
              deliveryoptimizer::api::JobInput{
                  .external_id = "order-1",
                  .lon = 7.4212,
                  .lat = 43.7308,
                  .demand = 1,
                  .service = 180,
                  .time_windows = std::nullopt,
              },
              deliveryoptimizer::api::JobInput{
                  .external_id = "order-2",
                  .lon = 7.4261,
                  .lat = 43.7412,
                  .demand = 1,
                  .service = 120,
                  .time_windows = std::nullopt,
              },
          },
  };

  Json::Value vroom_output{Json::objectValue};
  vroom_output["summary"] = Json::Value{Json::objectValue};
  vroom_output["summary"]["routes"] = 1;
  vroom_output["summary"]["unassigned"] = 1;

  Json::Value route{Json::objectValue};
  route["vehicle"] = Json::Int64{1};
  route["steps"] = Json::Value{Json::arrayValue};
  Json::Value step{Json::objectValue};
  step["type"] = "job";
  step["job"] = Json::Int64{1};
  route["steps"].append(step);

  vroom_output["routes"] = Json::Value{Json::arrayValue};
  vroom_output["routes"].append(route);

  Json::Value unassigned_entry{Json::objectValue};
  unassigned_entry["id"] = Json::Int64{2};
  vroom_output["unassigned"] = Json::Value{Json::arrayValue};
  vroom_output["unassigned"].append(unassigned_entry);

  const Json::Value body = deliveryoptimizer::api::BuildOptimizeSuccessBody(input, vroom_output);

  ASSERT_TRUE(body["routes"].isArray());
  ASSERT_EQ(body["routes"].size(), 1U);
  EXPECT_EQ(body["routes"][0]["vehicle_external_id"].asString(), "van-1");
  ASSERT_TRUE(body["routes"][0]["steps"].isArray());
  ASSERT_EQ(body["routes"][0]["steps"].size(), 1U);
  EXPECT_EQ(body["routes"][0]["steps"][0]["job_external_id"].asString(), "order-1");

  ASSERT_TRUE(body["unassigned"].isArray());
  ASSERT_EQ(body["unassigned"].size(), 1U);
  EXPECT_EQ(body["unassigned"][0]["job_external_id"].asString(), "order-2");
}

} // namespace
