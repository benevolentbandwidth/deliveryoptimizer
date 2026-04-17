#pragma once

#include "deliveryoptimizer/api/optimization_job_runtime.hpp"
#include "deliveryoptimizer/api/optimization_job_store.hpp"
#include "deliveryoptimizer/api/solve_admission.hpp"

#include <chrono>
#include <cstddef>
#include <cstdint>

namespace deliveryoptimizer::api {

struct ServerOptions {
  std::uint16_t listen_port;
  std::size_t worker_threads;
  bool enable_metrics{false};
  bool enable_sync_optimize{false};
  SolveAdmissionConfig solve_admission;
  OptimizationJobStoreConfig optimization_jobs;
  OptimizationJobRuntimeOptions optimization_job_runtime;
};

[[nodiscard]] ServerOptions LoadServerOptionsFromEnv();

} // namespace deliveryoptimizer::api
