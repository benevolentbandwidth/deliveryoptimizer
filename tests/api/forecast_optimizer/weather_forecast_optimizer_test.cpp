#include "deliveryoptimizer/adapters/json_utils.hpp"
#include "deliveryoptimizer/api/forecast_optimizer.hpp"
#include "deliveryoptimizer/api/solve_execution.hpp"

#include <gtest/gtest.h>
#include <json/json.h>
#include <optional>

namespace {

[[nodiscard]] Json::Value ParsePayloadText(const std::string& payload_text) {
  const auto payload = deliveryoptimizer::adapters::ParseJsonText(payload_text);
  EXPECT_TRUE(payload.has_value());
  return payload.value_or(Json::Value{Json::objectValue});
}

[[nodiscard]] deliveryoptimizer::api::OptimizeRequestInput BuildInput() {
  return deliveryoptimizer::api::OptimizeRequestInput{
      .depot_lon = -121.7405,
      .depot_lat = 38.5449,
      .vehicles =
          {
              deliveryoptimizer::api::VehicleInput{
                  .external_id = "driver-1",
                  .capacity = 8,
                  .start = std::nullopt,
                  .end = std::nullopt,
                  .time_window = std::nullopt,
              },
          },
      .jobs =
          {
              deliveryoptimizer::api::JobInput{
                  .external_id = "stop-1",
                  .lon = -121.748,
                  .lat = 38.545,
                  .demand = 1,
                  .service = 180,
                  .time_windows = std::nullopt,
              },
              deliveryoptimizer::api::JobInput{
                  .external_id = "stop-2",
                  .lon = -121.752,
                  .lat = 38.548,
                  .demand = 1,
                  .service = 120,
                  .time_windows = std::nullopt,
              },
          },
  };
}

[[nodiscard]] Json::Value BuildWeatherHour(const int dt, const int condition_id) {
  Json::Value hour{Json::objectValue};
  hour["dt"] = dt;
  hour["wind_speed"] = 0.0;
  hour["visibility"] = 10000;

  Json::Value condition{Json::objectValue};
  condition["id"] = condition_id;
  hour["weather"] = Json::Value{Json::arrayValue};
  hour["weather"].append(condition);
  return hour;
}

[[nodiscard]] Json::Value BuildRainyThunderHour() {
  Json::Value hour = BuildWeatherHour(0, 201);
  hour["rain"] = Json::Value{Json::objectValue};
  hour["rain"]["1h"] = 2.0;
  return hour;
}

} // namespace

TEST(WeatherForecastOptimizerTest, DisabledWeatherHasNoImpact) {
  const deliveryoptimizer::api::WeatherForecastOptions options{
      .enabled = false,
      .weather_delay_seconds_per_stop = 200,
      .reoptimize_threshold_seconds = 100,
      .reoptimize_threshold_percent = 0.0,
      .openweather_api_key = "",
      .openweather_base_url = "",
  };

  const deliveryoptimizer::api::WeatherImpactEstimate impact =
      deliveryoptimizer::api::EstimateWeatherImpact(options, 2U, 300);

  EXPECT_EQ(impact.weather_delay_seconds, 0);
  EXPECT_FALSE(impact.should_reoptimize);
}

TEST(WeatherForecastOptimizerTest, BelowThresholdWeatherDoesNotChangeVroomInput) {
  const auto input = BuildInput();
  const deliveryoptimizer::api::WeatherForecastOptions options{
      .enabled = true,
      .weather_delay_seconds_per_stop = 30,
      .reoptimize_threshold_seconds = 300,
      .reoptimize_threshold_percent = 0.0,
      .openweather_api_key = "",
      .openweather_base_url = "",
  };

  const Json::Value payload =
      ParsePayloadText(deliveryoptimizer::api::BuildWeatherAdjustedVroomInputText(
          input, deliveryoptimizer::api::EstimateWeatherImpact(options, input.jobs.size(), 300)));

  ASSERT_TRUE(payload["jobs"].isArray());
  ASSERT_EQ(payload["jobs"].size(), 2U);
  EXPECT_EQ(payload["jobs"][0]["service"].asInt(), 180);
  EXPECT_EQ(payload["jobs"][1]["service"].asInt(), 120);
}

TEST(WeatherForecastOptimizerTest, AboveThresholdWeatherAddsServiceTime) {
  const auto input = BuildInput();
  const deliveryoptimizer::api::WeatherForecastOptions options{
      .enabled = true,
      .weather_delay_seconds_per_stop = 200,
      .reoptimize_threshold_seconds = 100,
      .reoptimize_threshold_percent = 0.0,
      .openweather_api_key = "",
      .openweather_base_url = "",
  };

  const deliveryoptimizer::api::WeatherImpactEstimate impact =
      deliveryoptimizer::api::EstimateWeatherImpact(options, input.jobs.size(), 300);
  const Json::Value payload =
      ParsePayloadText(deliveryoptimizer::api::BuildWeatherAdjustedVroomInputText(input, impact));
  const Json::Value forecast =
      deliveryoptimizer::api::BuildWeatherForecastAnnotation(options, impact);

  ASSERT_TRUE(payload["jobs"].isArray());
  ASSERT_EQ(payload["jobs"].size(), 2U);
  EXPECT_EQ(payload["jobs"][0]["service"].asInt(), 380);
  EXPECT_EQ(payload["jobs"][1]["service"].asInt(), 320);
  EXPECT_EQ(forecast["weather_delay_seconds"].asInt(), 400);
  EXPECT_TRUE(forecast["reoptimization"]["applied"].asBool());
}
TEST(WeatherForecastOptimizerTest, ReadsVroomSummaryDuration) {
  Json::Value output{Json::objectValue};
  output["summary"] = Json::Value{Json::objectValue};
  output["summary"]["duration"] = 124.2;

  const std::optional<int> duration = deliveryoptimizer::api::ReadVroomDuration(output);

  ASSERT_TRUE(duration.has_value());
  EXPECT_EQ(*duration, 125);
}

TEST(WeatherForecastOptimizerTest, IgnoresMissingVroomSummaryDuration) {
  const Json::Value output{Json::objectValue};

  EXPECT_FALSE(deliveryoptimizer::api::ReadVroomDuration(output).has_value());
}

TEST(WeatherForecastOptimizerTest, ReadsEarliestVehicleStartTime) {
  auto input = BuildInput();
  input.vehicles.push_back(deliveryoptimizer::api::VehicleInput{
      .external_id = "driver-2",
      .capacity = 8,
      .start = std::nullopt,
      .end = std::nullopt,
      .time_window =
          deliveryoptimizer::api::TimeWindow{
              .start = std::chrono::sys_seconds{std::chrono::seconds{1800}},
              .end = std::chrono::sys_seconds{std::chrono::seconds{7200}},
          },
  });
  input.vehicles[0].time_window = deliveryoptimizer::api::TimeWindow{
      .start = std::chrono::sys_seconds{std::chrono::seconds{900}},
      .end = std::chrono::sys_seconds{std::chrono::seconds{3600}},
  };

  const std::optional<std::chrono::sys_seconds> planned_start =
      deliveryoptimizer::api::ReadRouteStartTime(input);

  ASSERT_TRUE(planned_start.has_value());
  EXPECT_EQ(planned_start->time_since_epoch(), std::chrono::seconds{900});
}

TEST(WeatherForecastOptimizerTest, MissingVehicleTimeWindowHasNoPlannedStart) {
  const auto input = BuildInput();

  EXPECT_FALSE(deliveryoptimizer::api::ReadRouteStartTime(input).has_value());
}

TEST(WeatherForecastOptimizerTest, ReadsOpenWeatherHourNearRouteStart) {
  Json::Value body{Json::objectValue};
  body["hourly"] = Json::Value{Json::arrayValue};
  body["hourly"].append(BuildWeatherHour(0, 201));
  body["hourly"].append(BuildWeatherHour(7200, 800));
  body["hourly"].append(BuildWeatherHour(10800, 201));

  const int delay = deliveryoptimizer::api::ReadOpenWeatherDelay(
      body, std::chrono::sys_seconds{std::chrono::seconds{7200}}, 1800);

  EXPECT_EQ(delay, 0);
}

TEST(WeatherForecastOptimizerTest, ReadsBadOpenWeatherHourNearRouteStart) {
  Json::Value body{Json::objectValue};
  body["hourly"] = Json::Value{Json::arrayValue};
  body["hourly"].append(BuildWeatherHour(0, 800));
  body["hourly"].append(BuildWeatherHour(7200, 201));

  const int delay = deliveryoptimizer::api::ReadOpenWeatherDelay(
      body, std::chrono::sys_seconds{std::chrono::seconds{7200}}, 1800);

  EXPECT_EQ(delay, 240);
}

TEST(WeatherForecastOptimizerTest, ThunderDoesNotAlsoChargeRainDelay) {
  Json::Value body{Json::objectValue};
  body["hourly"] = Json::Value{Json::arrayValue};
  body["hourly"].append(BuildRainyThunderHour());

  const int delay = deliveryoptimizer::api::ReadOpenWeatherDelay(body);

  EXPECT_EQ(delay, 240);
}

TEST(WeatherForecastOptimizerTest, RefinesForecastWithVroomSummaryDuration) {
  auto input = BuildInput();
  input.vehicles[0].time_window = deliveryoptimizer::api::TimeWindow{
      .start = std::chrono::sys_seconds{std::chrono::seconds{600}},
      .end = std::chrono::sys_seconds{std::chrono::seconds{3600}},
  };
  const deliveryoptimizer::api::WeatherForecastOptions options{
      .enabled = true,
      .weather_delay_seconds_per_stop = 200,
      .reoptimize_threshold_seconds = 100,
      .reoptimize_threshold_percent = 0.0,
      .openweather_api_key = "",
      .openweather_base_url = "",
  };
  Json::Value output{Json::objectValue};
  output["summary"] = Json::Value{Json::objectValue};
  output["summary"]["duration"] = 960;

  const deliveryoptimizer::api::WeatherImpactEstimate impact =
      deliveryoptimizer::api::RecalculateWeatherImpact(options, input, output);
  const Json::Value forecast =
      deliveryoptimizer::api::BuildWeatherForecastAnnotation(options, impact);

  EXPECT_FALSE(forecast.isMember("baseline_duration_seconds"));
  EXPECT_EQ(forecast["baseline_route_duration_seconds"].asInt(), 960);
  EXPECT_EQ(forecast["weather_delay_seconds"].asInt(), 400);
  EXPECT_EQ(forecast["weather_adjusted_duration_seconds"].asInt(), 1360);
  EXPECT_FALSE(forecast.isMember("predicted_duration_seconds"));
  EXPECT_EQ(forecast["planned_start_time"].asInt64(), 600);
  EXPECT_EQ(forecast["estimated_finish_time"].asInt64(), 1960);
}

TEST(TrafficForecastOptimizerTest, DisabledTrafficHasNoImpact) {
  const deliveryoptimizer::api::TrafficForecastOptions options{
      .enabled = false,
      .reoptimize_threshold_seconds = 100,
      .reoptimize_threshold_percent = 0.0,
      .google_maps_api_key = "",
      .google_maps_base_url = "",
  };

  const deliveryoptimizer::api::TrafficImpact impact =
      deliveryoptimizer::api::EstimateTrafficImpact(options, 900, 300, "google_maps");

  EXPECT_EQ(impact.traffic_delay_seconds, 0);
  EXPECT_FALSE(impact.should_reoptimize);
  EXPECT_EQ(impact.source, "disabled");
}

TEST(TrafficForecastOptimizerTest, BelowThresholdTrafficDoesNotReoptimize) {
  const deliveryoptimizer::api::TrafficForecastOptions options{
      .enabled = true,
      .reoptimize_threshold_seconds = 300,
      .reoptimize_threshold_percent = 0.0,
      .google_maps_api_key = "",
      .google_maps_base_url = "",
  };

  const deliveryoptimizer::api::TrafficImpact impact =
      deliveryoptimizer::api::EstimateTrafficImpact(options, 900, 120, "google_maps");

  EXPECT_EQ(impact.traffic_delay_seconds, 120);
  EXPECT_EQ(impact.traffic_adjusted_duration_seconds, 1020);
  EXPECT_FALSE(impact.should_reoptimize);
}

TEST(TrafficForecastOptimizerTest, AboveThresholdTrafficReoptimizes) {
  const deliveryoptimizer::api::TrafficForecastOptions options{
      .enabled = true,
      .reoptimize_threshold_seconds = 100,
      .reoptimize_threshold_percent = 0.0,
      .google_maps_api_key = "",
      .google_maps_base_url = "",
  };

  const deliveryoptimizer::api::TrafficImpact impact =
      deliveryoptimizer::api::EstimateTrafficImpact(options, 900, 180, "google_maps");

  EXPECT_EQ(impact.traffic_delay_seconds, 180);
  EXPECT_TRUE(impact.should_reoptimize);
}
TEST(TrafficForecastOptimizerTest, AboveThresholdTrafficAddsServiceTime) {
  const auto input = BuildInput();
  Json::Value output{Json::objectValue};
  output["routes"] = Json::Value{Json::arrayValue};
  Json::Value route{Json::objectValue};
  route["steps"] = Json::Value{Json::arrayValue};

  Json::Value start{Json::objectValue};
  start["arrival"] = 0;
  start["location"] = Json::Value{Json::arrayValue};
  start["location"].append(-121.7405);
  start["location"].append(38.5449);

  Json::Value first_stop{Json::objectValue};
  first_stop["type"] = "job";
  first_stop["id"] = 1;
  first_stop["arrival"] = 300;
  first_stop["service"] = 180;
  first_stop["location"] = Json::Value{Json::arrayValue};
  first_stop["location"].append(-121.748);
  first_stop["location"].append(38.545);

  Json::Value second_stop{Json::objectValue};
  second_stop["type"] = "job";
  second_stop["id"] = 2;
  second_stop["arrival"] = 1080;
  second_stop["service"] = 120;
  second_stop["location"] = Json::Value{Json::arrayValue};
  second_stop["location"].append(-121.752);
  second_stop["location"].append(38.548);

  route["steps"].append(start);
  route["steps"].append(first_stop);
  route["steps"].append(second_stop);
  output["routes"].append(route);

  const deliveryoptimizer::api::WeatherImpactEstimate weather{};
  const deliveryoptimizer::api::TrafficImpact traffic{
      .baseline_duration_seconds = 900,
      .traffic_delay_seconds = 180,
      .traffic_adjusted_duration_seconds = 1080,
      .reoptimize_threshold_seconds = 100,
      .should_reoptimize = true,
      .source = "google_maps",
  };

  const Json::Value payload =
      deliveryoptimizer::api::BuildTrafficAdjustedVroomInput(input, weather, traffic, output);

  ASSERT_TRUE(payload["jobs"].isArray());
  ASSERT_EQ(payload["jobs"].size(), 2U);
  EXPECT_EQ(payload["jobs"][0]["service"].asInt(), 240);
  EXPECT_EQ(payload["jobs"][1]["service"].asInt(), 240);
}
TEST(TrafficForecastOptimizerTest, BuildsGoogleTrafficPath) {
  const std::string path = deliveryoptimizer::api::BuildTrafficPath(
      deliveryoptimizer::api::Coordinate{.lon = -121.7405, .lat = 38.5449},
      deliveryoptimizer::api::Coordinate{.lon = -121.752, .lat = 38.548},
      std::chrono::sys_seconds{std::chrono::seconds{1800}}, "test-key");

  EXPECT_NE(path.find("/maps/api/distancematrix/json?"), std::string::npos);
  EXPECT_NE(path.find("origins=38.544900,-121.740500"), std::string::npos);
  EXPECT_NE(path.find("destinations=38.548000,-121.752000"), std::string::npos);
  EXPECT_NE(path.find("departure_time=1800"), std::string::npos);
  EXPECT_NE(path.find("traffic_model=best_guess"), std::string::npos);
  EXPECT_NE(path.find("key=test-key"), std::string::npos);
}

TEST(TrafficForecastOptimizerTest, ReadsGoogleTrafficDelay) {
  Json::Value body{Json::objectValue};
  body["rows"] = Json::Value{Json::arrayValue};
  Json::Value row{Json::objectValue};
  row["elements"] = Json::Value{Json::arrayValue};
  Json::Value leg{Json::objectValue};
  leg["status"] = "OK";
  leg["duration"]["value"] = 600;
  leg["duration_in_traffic"]["value"] = 780;
  row["elements"].append(leg);
  body["rows"].append(row);

  const std::optional<int> delay = deliveryoptimizer::api::ReadTrafficDelay(body);

  ASSERT_TRUE(delay.has_value());
  EXPECT_EQ(*delay, 180);
}

TEST(TrafficForecastOptimizerTest, IgnoresMissingTrafficDuration) {
  const Json::Value body{Json::objectValue};

  EXPECT_FALSE(deliveryoptimizer::api::ReadTrafficDelay(body).has_value());
}
TEST(TrafficForecastOptimizerTest, AddsTrafficForecastBlock) {
  Json::Value forecast{Json::objectValue};
  const deliveryoptimizer::api::TrafficForecastOptions options{
      .enabled = true,
      .reoptimize_threshold_seconds = 100,
      .reoptimize_threshold_percent = 0.0,
      .google_maps_api_key = "",
      .google_maps_base_url = "",
  };
  const deliveryoptimizer::api::TrafficImpact impact{
      .baseline_duration_seconds = 900,
      .traffic_delay_seconds = 180,
      .traffic_adjusted_duration_seconds = 1080,
      .reoptimize_threshold_seconds = 100,
      .should_reoptimize = true,
      .source = "google_maps",
  };

  deliveryoptimizer::api::AddTrafficForecast(forecast, options, impact);

  EXPECT_EQ(forecast["traffic"]["status"].asString(), "evaluated");
  EXPECT_EQ(forecast["traffic"]["provider"].asString(), "google_maps");
  EXPECT_EQ(forecast["traffic"]["traffic_delay_seconds"].asInt(), 180);
  EXPECT_TRUE(forecast["traffic"]["reoptimization"]["applied"].asBool());
}
TEST(TrafficForecastOptimizerTest, ReadsTrafficLegsFromVroomSteps) {
  // These arrivals already include the route start time.
  const auto route_start =
      std::chrono::time_point_cast<std::chrono::seconds>(std::chrono::system_clock::now()) +
      std::chrono::hours{1};
  const auto route_start_seconds = route_start.time_since_epoch();
  const int route_start_value = static_cast<int>(route_start_seconds.count());

  Json::Value output{Json::objectValue};
  output["routes"] = Json::Value{Json::arrayValue};

  Json::Value route{Json::objectValue};
  route["steps"] = Json::Value{Json::arrayValue};

  Json::Value start{Json::objectValue};
  start["arrival"] = route_start_value;
  start["location"] = Json::Value{Json::arrayValue};
  start["location"].append(-121.7405);
  start["location"].append(38.5449);

  Json::Value stop{Json::objectValue};
  stop["arrival"] = route_start_value + 600;
  stop["service"] = 120;
  stop["location"] = Json::Value{Json::arrayValue};
  stop["location"].append(-121.752);
  stop["location"].append(38.548);

  Json::Value end{Json::objectValue};
  end["arrival"] = route_start_value + 1200;
  end["location"] = Json::Value{Json::arrayValue};
  end["location"].append(-121.7405);
  end["location"].append(38.5449);

  route["steps"].append(start);
  route["steps"].append(stop);
  route["steps"].append(end);
  output["routes"].append(route);

  const std::vector<deliveryoptimizer::api::TrafficLeg> legs =
      deliveryoptimizer::api::ReadTrafficLegs(output, route_start);

  ASSERT_EQ(legs.size(), 2U);
  EXPECT_EQ(legs[0].departure_time, route_start);
  EXPECT_EQ(legs[1].departure_time, route_start + std::chrono::seconds{720});
  EXPECT_DOUBLE_EQ(legs[0].origin.lon, -121.7405);
  EXPECT_DOUBLE_EQ(legs[0].destination.lon, -121.752);
}
TEST(TrafficForecastOptimizerTest, ReadsRelativeTrafficLegDepartures) {
  const auto route_start =
      std::chrono::time_point_cast<std::chrono::seconds>(std::chrono::system_clock::now()) +
      std::chrono::hours{1};

  Json::Value output{Json::objectValue};
  output["routes"] = Json::Value{Json::arrayValue};

  Json::Value route{Json::objectValue};
  route["steps"] = Json::Value{Json::arrayValue};

  Json::Value start{Json::objectValue};
  start["arrival"] = 0;
  start["location"] = Json::Value{Json::arrayValue};
  start["location"].append(-121.7405);
  start["location"].append(38.5449);

  Json::Value stop{Json::objectValue};
  stop["arrival"] = 600;
  stop["service"] = 120;
  stop["location"] = Json::Value{Json::arrayValue};
  stop["location"].append(-121.752);
  stop["location"].append(38.548);

  Json::Value end{Json::objectValue};
  end["arrival"] = 1200;
  end["location"] = Json::Value{Json::arrayValue};
  end["location"].append(-121.7405);
  end["location"].append(38.5449);

  route["steps"].append(start);
  route["steps"].append(stop);
  route["steps"].append(end);
  output["routes"].append(route);

  const std::vector<deliveryoptimizer::api::TrafficLeg> legs =
      deliveryoptimizer::api::ReadTrafficLegs(output, route_start);

  ASSERT_EQ(legs.size(), 2U);
  EXPECT_EQ(legs[0].departure_time, route_start);
  EXPECT_EQ(legs[1].departure_time, route_start + std::chrono::seconds{720});
}

TEST(TrafficForecastOptimizerTest, ClampsPastRelativeDeparturesToNow) {
  Json::Value output{Json::objectValue};
  output["routes"] = Json::Value{Json::arrayValue};
  Json::Value route{Json::objectValue};
  route["steps"] = Json::Value{Json::arrayValue};
  for (int index = 0; index < 2; ++index) {
    Json::Value step{Json::objectValue};
    step["arrival"] = index * 60;
    step["location"] = Json::Value{Json::arrayValue};
    step["location"].append(-121.7405 + index * 0.01);
    step["location"].append(38.5449 + index * 0.01);
    route["steps"].append(std::move(step));
  }
  output["routes"].append(std::move(route));
  const auto before =
      std::chrono::time_point_cast<std::chrono::seconds>(std::chrono::system_clock::now());

  const auto legs = deliveryoptimizer::api::ReadTrafficLegs(output, before - std::chrono::hours{1});

  ASSERT_EQ(legs.size(), 1U);
  EXPECT_GE(legs[0].departure_time, before);
}

TEST(TrafficForecastOptimizerTest, IgnoresAbsoluteArrivalWithoutRouteStart) {
  Json::Value output{Json::objectValue};
  output["routes"] = Json::Value{Json::arrayValue};
  Json::Value route{Json::objectValue};
  route["steps"] = Json::Value{Json::arrayValue};
  for (int index = 0; index < 2; ++index) {
    Json::Value step{Json::objectValue};
    step["arrival"] = 1'800'000'000 + index * 60;
    step["location"] = Json::Value{Json::arrayValue};
    step["location"].append(-121.7405 + index * 0.01);
    step["location"].append(38.5449 + index * 0.01);
    route["steps"].append(std::move(step));
  }
  output["routes"].append(std::move(route));
  const auto before =
      std::chrono::time_point_cast<std::chrono::seconds>(std::chrono::system_clock::now());

  const auto legs = deliveryoptimizer::api::ReadTrafficLegs(output);
  const auto after =
      std::chrono::time_point_cast<std::chrono::seconds>(std::chrono::system_clock::now());

  ASSERT_EQ(legs.size(), 1U);
  EXPECT_GE(legs[0].departure_time, before);
  EXPECT_LE(legs[0].departure_time, after);
}

TEST(TrafficForecastOptimizerTest, KeepsBaselineWhenTrafficRerunFails) {
  Json::Value baseline_output{Json::objectValue};
  baseline_output["summary"]["duration"] = 900;
  deliveryoptimizer::api::CoordinatedSolveResult baseline{
      .status = deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded,
      .output = baseline_output,
  };
  deliveryoptimizer::api::CoordinatedSolveResult failed_rerun{
      .status = deliveryoptimizer::api::CoordinatedSolveStatus::kTimedOut,
      .output = std::nullopt,
  };

  const auto result =
      deliveryoptimizer::api::PreferSuccessfulRerun(std::move(baseline), std::move(failed_rerun));

  ASSERT_TRUE(result.output.has_value());
  EXPECT_EQ(result.status, deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
  EXPECT_EQ((*result.output)["summary"]["duration"].asInt(), 900);
}

TEST(TrafficForecastOptimizerTest, UsesSuccessfulTrafficRerun) {
  Json::Value baseline_output{Json::objectValue};
  baseline_output["summary"]["duration"] = 900;
  Json::Value rerun_output{Json::objectValue};
  rerun_output["summary"]["duration"] = 840;

  const auto result = deliveryoptimizer::api::PreferSuccessfulRerun(
      deliveryoptimizer::api::CoordinatedSolveResult{
          .status = deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded,
          .output = std::move(baseline_output),
      },
      deliveryoptimizer::api::CoordinatedSolveResult{
          .status = deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded,
          .output = std::move(rerun_output),
      });

  ASSERT_TRUE(result.output.has_value());
  EXPECT_EQ((*result.output)["summary"]["duration"].asInt(), 840);
}

TEST(TrafficForecastOptimizerTest, CentralizesDisabledTrafficPostprocessing) {
  Json::Value route_output{Json::objectValue};
  route_output["summary"]["duration"] = 900;
  Json::Value forecast{Json::objectValue};

  const auto plan = deliveryoptimizer::api::PrepareTrafficPostprocessing(
      deliveryoptimizer::api::TrafficForecastOptions{}, BuildInput(),
      deliveryoptimizer::api::WeatherImpactEstimate{}, route_output, forecast);

  EXPECT_FALSE(plan.adjusted_vroom_input.has_value());
  EXPECT_FALSE(plan.impact.should_reoptimize);
  EXPECT_EQ(forecast["traffic"]["status"].asString(), "disabled");
}
