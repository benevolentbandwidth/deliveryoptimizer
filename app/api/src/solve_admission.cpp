#include "deliveryoptimizer/api/solve_admission.hpp"

#include <algorithm>

namespace deliveryoptimizer::api {

SolveAdmissionStatus EvaluateSolveAdmission(const SolveAdmissionConfig& config,
                                            const SolveRequestSize& request_size,
                                            const std::size_t active_solves,
                                            const std::size_t queued_solves) {
  if (request_size.jobs > config.max_sync_jobs) {
    return SolveAdmissionStatus::kRejectedTooManyJobs;
  }
  if (request_size.vehicles > config.max_sync_vehicles) {
    return SolveAdmissionStatus::kRejectedTooManyVehicles;
  }

  const std::size_t accepted_solves = active_solves + queued_solves;
  const std::size_t reserved_concurrency_slots = std::min(accepted_solves, config.max_concurrency);
  const std::size_t buffered_queue =
      accepted_solves > config.max_concurrency ? accepted_solves - config.max_concurrency : 0U;

  if (reserved_concurrency_slots >= config.max_concurrency &&
      buffered_queue >= config.max_queue_size) {
    return SolveAdmissionStatus::kRejectedQueueFull;
  }
  return SolveAdmissionStatus::kAccepted;
}

} // namespace deliveryoptimizer::api
