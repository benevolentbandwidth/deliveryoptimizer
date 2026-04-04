#pragma once

#include "deliveryoptimizer/api/solve_admission.hpp"

#include <chrono>
#include <cstddef>
#include <cstdint>

namespace deliveryoptimizer::api {

struct ServerOptions {
  std::uint16_t listen_port;
  std::size_t worker_threads;
  SolveAdmissionConfig solve_admission;
};

[[nodiscard]] ServerOptions LoadServerOptionsFromEnv();

} // namespace deliveryoptimizer::api
