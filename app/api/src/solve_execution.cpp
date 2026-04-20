#include "deliveryoptimizer/api/solve_execution.hpp"

namespace deliveryoptimizer::api {

SolveExecutionResult BuildSolveExecutionResult(const OptimizeRequestInput& input,
                                               const CoordinatedSolveResult& result) {
  switch (result.status) {
  case CoordinatedSolveStatus::kSucceeded:
    if (result.output.has_value()) {
      return SolveExecutionResult{
          .outcome = SolveRequestOutcome::kSucceeded,
          .http_status = 200U,
          .response_body = BuildOptimizeSuccessBody(input, *result.output),
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
