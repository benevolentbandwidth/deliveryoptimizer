#pragma once

#include <cstddef>
#include <cstdint>

namespace deliveryoptimizer::api {

struct ServerOptions {
  std::uint16_t listen_port;
  std::size_t worker_threads;
};

[[nodiscard]] ServerOptions LoadServerOptionsFromEnv();

} // namespace deliveryoptimizer::api
