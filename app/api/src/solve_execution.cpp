#include "deliveryoptimizer/api/solve_execution.hpp"

namespace {

[[nodiscard]] deliveryoptimizer::api::CoordinatedSolveResult ToCoordinatedSolveResult(
    const deliveryoptimizer::api::VroomRunResult& result) {
  switch (result.status) {
  case deliveryoptimizer::api::VroomRunStatus::kSuccess:
    return deliveryoptimizer::api::CoordinatedSolveResult{
        .status = deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded,
        .output = result.output,
    };
  case deliveryoptimizer::api::VroomRunStatus::kTimedOut:
    return deliveryoptimizer::api::CoordinatedSolveResult{
        .status = deliveryoptimizer::api::CoordinatedSolveStatus::kTimedOut,
        .output = std::nullopt,
    };
  case deliveryoptimizer::api::VroomRunStatus::kFailed:
    break;
  }

  return deliveryoptimizer::api::CoordinatedSolveResult{
      .status = deliveryoptimizer::api::CoordinatedSolveStatus::kFailed,
      .output = std::nullopt,
  };
}

} // namespace

namespace deliveryoptimizer::api {

SolveExecutionResult BuildSolveExecutionResult(const OptimizeRequestInput& input,
                                               const CoordinatedSolveResult& result) {
  switch (result.status) {
  case CoordinatedSolveStatus::kSucceeded:
    if (result.output.has_value()) {
      return SolveExecutionResult{
          .status = SolveExecutionStatus::kSucceeded,
          .outcome = SolveRequestOutcome::kSucceeded,
          .http_status = 200U,
          .response_body = BuildOptimizeSuccessBody(input, *result.output),
          .error_message = {},
      };
    }
    return SolveExecutionResult{
        .status = SolveExecutionStatus::kFailed,
        .outcome = SolveRequestOutcome::kFailed,
        .http_status = 502U,
        .response_body = std::nullopt,
        .error_message = "Routing optimization failed.",
    };
  case CoordinatedSolveStatus::kTimedOut:
    return SolveExecutionResult{
        .status = SolveExecutionStatus::kTimedOut,
        .outcome = SolveRequestOutcome::kSolveTimedOut,
        .http_status = 504U,
        .response_body = std::nullopt,
        .error_message = "Routing optimization timed out.",
    };
  case CoordinatedSolveStatus::kQueueWaitTimedOut:
    return SolveExecutionResult{
        .status = SolveExecutionStatus::kQueueWaitTimedOut,
        .outcome = SolveRequestOutcome::kQueueWaitTimedOut,
        .http_status = 503U,
        .response_body = std::nullopt,
        .error_message = "Routing optimization queue wait timed out.",
    };
  case CoordinatedSolveStatus::kFailed:
    break;
  }

  return SolveExecutionResult{
      .status = SolveExecutionStatus::kFailed,
      .outcome = SolveRequestOutcome::kFailed,
      .http_status = 502U,
      .response_body = std::nullopt,
      .error_message = "Routing optimization failed.",
  };
}

SolveExecutionResult BuildSolveExecutionResult(const OptimizeRequestInput& input,
                                               const VroomRunResult& result) {
  return BuildSolveExecutionResult(input, ToCoordinatedSolveResult(result));
}

} // namespace deliveryoptimizer::api
