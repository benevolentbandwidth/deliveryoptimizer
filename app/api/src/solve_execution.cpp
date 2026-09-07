#include "deliveryoptimizer/api/solve_execution.hpp"

#include <utility>

namespace deliveryoptimizer::api {

CoordinatedSolveResult ToCoordinatedSolveResult(VroomRunResult&& result) {
  switch (result.status) {
  case VroomRunStatus::kSuccess:
    return CoordinatedSolveResult{
        .status = CoordinatedSolveStatus::kSucceeded,
        .output = std::move(result.output),
    };
  case VroomRunStatus::kTimedOut:
    return CoordinatedSolveResult{
        .status = CoordinatedSolveStatus::kTimedOut,
        .output = std::nullopt,
    };
  case VroomRunStatus::kFailed:
    break;
  }

  return CoordinatedSolveResult{
      .status = CoordinatedSolveStatus::kFailed,
      .output = std::nullopt,
  };
}

CoordinatedSolveResult PreferSuccessfulRerun(CoordinatedSolveResult baseline,
                                             CoordinatedSolveResult rerun) {
  const bool rerun_succeeded =
      rerun.status == CoordinatedSolveStatus::kSucceeded && rerun.output.has_value();
  return rerun_succeeded ? std::move(rerun) : std::move(baseline);
}

SolveExecutionResult BuildSolveExecutionResult(const OptimizeRequestInput& input,
                                               CoordinatedSolveResult result,
                                               std::optional<Json::Value> forecast) {
  switch (result.status) {
  case CoordinatedSolveStatus::kSucceeded:
    if (result.output.has_value()) {
      return SolveExecutionResult{
          .outcome = SolveRequestOutcome::kSucceeded,
          .http_status = 200U,
          .response_body =
              BuildOptimizeSuccessBody(input, std::move(*result.output), std::move(forecast)),
          .error_message = {},
      };
    }
    return SolveExecutionResult{
        .outcome = SolveRequestOutcome::kFailed,
        .http_status = 502U,
        .response_body = std::nullopt,
        .error_message = "Routing optimization failed.",
    };
  case CoordinatedSolveStatus::kTimedOut:
    return SolveExecutionResult{
        .outcome = SolveRequestOutcome::kSolveTimedOut,
        .http_status = 504U,
        .response_body = std::nullopt,
        .error_message = "Routing optimization timed out.",
    };
  case CoordinatedSolveStatus::kQueueWaitTimedOut:
    return SolveExecutionResult{
        .outcome = SolveRequestOutcome::kQueueWaitTimedOut,
        .http_status = 503U,
        .response_body = std::nullopt,
        .error_message = "Routing optimization queue wait timed out.",
    };
  case CoordinatedSolveStatus::kFailed:
    break;
  }

  return SolveExecutionResult{
      .outcome = SolveRequestOutcome::kFailed,
      .http_status = 502U,
      .response_body = std::nullopt,
      .error_message = "Routing optimization failed.",
  };
}

} // namespace deliveryoptimizer::api
