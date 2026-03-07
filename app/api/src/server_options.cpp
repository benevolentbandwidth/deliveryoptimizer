#include "deliveryoptimizer/api/server_options.hpp"

#include <algorithm>
#include <cerrno>
#include <cstdlib>
#include <limits>
#include <thread>

namespace {

constexpr std::uint16_t kDefaultListenPort = 8080U;
constexpr std::size_t kMaxWorkerThreads = 64U;

[[nodiscard]] std::uint16_t ResolveListenPort() {
  const char* raw_port = std::getenv("DELIVERYOPTIMIZER_PORT");
  if (raw_port == nullptr || *raw_port == '\0') {
    return kDefaultListenPort;
  }

  errno = 0;
  char* end = nullptr;
  const long parsed = std::strtol(raw_port, &end, 10);
  const bool invalid = errno != 0 || end == raw_port || *end != '\0' || parsed <= 0L ||
                       parsed > static_cast<long>(std::numeric_limits<std::uint16_t>::max());
  if (invalid) {
    return kDefaultListenPort;
  }

  return static_cast<std::uint16_t>(parsed);
}

[[nodiscard]] std::size_t ResolveThreadCount() {
  const auto detected = std::thread::hardware_concurrency();
  const std::size_t default_threads = detected == 0U ? 1U : static_cast<std::size_t>(detected);
  const std::size_t bounded_default_threads = std::min(default_threads, kMaxWorkerThreads);

  const char* raw_threads = std::getenv("DELIVERYOPTIMIZER_THREADS");
  if (raw_threads == nullptr || *raw_threads == '\0') {
    return bounded_default_threads;
  }

  errno = 0;
  char* end = nullptr;
  const long parsed = std::strtol(raw_threads, &end, 10);
  const bool invalid = errno != 0 || end == raw_threads || *end != '\0' || parsed <= 0L;
  if (invalid) {
    return bounded_default_threads;
  }

  const auto requested_threads = static_cast<std::size_t>(parsed);
  return std::min(requested_threads, kMaxWorkerThreads);
}

} // namespace

namespace deliveryoptimizer::api {

ServerOptions LoadServerOptionsFromEnv() {
  return ServerOptions{.listen_port = ResolveListenPort(), .worker_threads = ResolveThreadCount()};
}

} // namespace deliveryoptimizer::api
