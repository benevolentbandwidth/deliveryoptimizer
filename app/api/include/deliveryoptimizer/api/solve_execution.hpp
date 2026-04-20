#pragma once

#include "deliveryoptimizer/api/observability.hpp"
#include "deliveryoptimizer/api/optimize_request.hpp"
#include "deliveryoptimizer/api/solve_coordinator.hpp"

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

[[nodiscard]] SolveExecutionResult BuildSolveExecutionResult(const OptimizeRequestInput& input,
                                                             const CoordinatedSolveResult& result);

} // namespace deliveryoptimizer::api
