#pragma once

#include "deliveryoptimizer/api/observability.hpp"
#include "deliveryoptimizer/api/optimize_request.hpp"
#include "deliveryoptimizer/api/solve_coordinator.hpp"
#include "deliveryoptimizer/api/vroom_runner.hpp"

#include <cstdint>
#include <json/json.h>
#include <optional>
#include <string>

namespace deliveryoptimizer::api {

struct SolveExecutionResult {
  SolveRequestOutcome outcome{SolveRequestOutcome::kFailed};
  std::uint16_t http_status{502U};
  std::optional<Json::Value> response_body;
  std::string error_message;
};

[[nodiscard]] SolveExecutionResult
BuildSolveExecutionResult(const OptimizeRequestInput& input, CoordinatedSolveResult result,
                          std::optional<Json::Value> forecast = std::nullopt);

// Takes ownership of the run result so the parsed vroom output tree is moved,
// not deep-copied (jsoncpp values are not copy-on-write).
[[nodiscard]] CoordinatedSolveResult ToCoordinatedSolveResult(VroomRunResult&& result);

// Optional forecast reruns must never replace an already-usable route with a failure.
[[nodiscard]] CoordinatedSolveResult PreferSuccessfulRerun(CoordinatedSolveResult baseline,
                                                           CoordinatedSolveResult rerun);

} // namespace deliveryoptimizer::api
