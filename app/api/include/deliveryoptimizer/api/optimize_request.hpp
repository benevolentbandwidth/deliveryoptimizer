#pragma once

#include "deliveryoptimizer/api/solve_admission.hpp"

#include <chrono>
#include <json/json.h>
#include <optional>
#include <string>
#include <vector>

namespace deliveryoptimizer::api {

struct Coordinate {
  double lon;
  double lat;
};

struct TimeWindow {
  std::chrono::sys_seconds start;
  std::chrono::sys_seconds end;
};

struct VehicleInput {
  std::string external_id;
  int capacity;
  std::optional<Coordinate> start;
  std::optional<Coordinate> end;
  std::optional<TimeWindow> time_window;
};

struct JobInput {
  std::string external_id;
  double lon;
  double lat;
  int demand;
  int service;
  std::optional<std::vector<TimeWindow>> time_windows;
};

struct OptimizeRequestInput {
  double depot_lon;
  double depot_lat;
  std::vector<VehicleInput> vehicles;
  std::vector<JobInput> jobs;
};

struct ParsedOptimizeRequest {
  OptimizeRequestInput input;
  SolveRequestSize size;
};

[[nodiscard]] std::optional<ParsedOptimizeRequest>
ParseAndValidateOptimizeRequest(const Json::Value& root, Json::Value& issues);

[[nodiscard]] std::optional<SolveRequestSize> TryParseOptimizeRequestSize(const Json::Value& root);

[[nodiscard]] Json::Value BuildVroomInput(const OptimizeRequestInput& input);

[[nodiscard]] Json::Value BuildOptimizeSuccessBody(const OptimizeRequestInput& input,
                                                   const Json::Value& vroom_output);

} // namespace deliveryoptimizer::api
