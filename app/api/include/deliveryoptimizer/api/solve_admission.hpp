#pragma once

#include <chrono>
#include <cstddef>
#include <cstdint>

namespace deliveryoptimizer::api {

struct SolveAdmissionConfig {
  std::size_t max_concurrency;
  std::size_t max_queue_size;
  std::chrono::milliseconds max_queue_wait;
  std::size_t max_sync_jobs;
  std::size_t max_sync_vehicles;
};

struct SolveRequestSize {
  std::size_t jobs;
  std::size_t vehicles;
};

enum class SolveAdmissionStatus : std::uint8_t {
  kAccepted,
  kRejectedTooManyJobs,
  kRejectedTooManyVehicles,
  kRejectedQueueFull,
};

[[nodiscard]] SolveAdmissionStatus EvaluateSolveAdmission(const SolveAdmissionConfig& config,
                                                          const SolveRequestSize& request_size,
                                                          std::size_t active_solves,
                                                          std::size_t queued_solves);

} // namespace deliveryoptimizer::api
