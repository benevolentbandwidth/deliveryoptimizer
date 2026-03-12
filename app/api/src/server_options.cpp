#include "deliveryoptimizer/api/server_options.hpp"

#include <algorithm>
#include <charconv>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <optional>
#include <string_view>
#include <thread>

namespace {

constexpr std::uint16_t kDefaultListenPort = 8080U;
constexpr std::size_t kMaxWorkerThreads = 64U;
constexpr std::string_view kListenPortEnv = "DELIVERYOPTIMIZER_PORT";
constexpr std::string_view kThreadCountEnv = "DELIVERYOPTIMIZER_THREADS";

template <typename Integer>
[[nodiscard]] std::optional<Integer> ParsePositiveIntegerEnv(const char* raw_value) {
  if (raw_value == nullptr || *raw_value == '\0') {
    return std::nullopt;
  }

  const std::string_view value_text{raw_value};
  Integer parsed_value = 0;
  const auto [end_ptr, error] =
      std::from_chars(value_text.data(), value_text.data() + value_text.size(), parsed_value);

  if (error != std::errc{} || end_ptr != value_text.data() + value_text.size() ||
      parsed_value == 0) {
    return std::nullopt;
  }

  return parsed_value;
}

[[nodiscard]] std::optional<std::uint16_t> ResolveListenPort() {
  const char* raw_port = std::getenv(kListenPortEnv.data());
  if (raw_port == nullptr || *raw_port == '\0') {
    return kDefaultListenPort;
  }

  const auto parsed_port = ParsePositiveIntegerEnv<std::uint32_t>(raw_port);
  if (!parsed_port.has_value() ||
      *parsed_port > static_cast<std::uint32_t>(std::numeric_limits<std::uint16_t>::max())) {
    std::cerr << "Invalid DELIVERYOPTIMIZER_PORT='" << raw_port
              << "'. Expected an integer in the range 1..65535.\n";
    return std::nullopt;
  }

  return static_cast<std::uint16_t>(*parsed_port);
}

[[nodiscard]] std::size_t ResolveThreadCount() {
  const auto detected = std::thread::hardware_concurrency();
  const std::size_t default_threads = detected == 0U ? 1U : static_cast<std::size_t>(detected);
  const std::size_t bounded_default_threads = std::min(default_threads, kMaxWorkerThreads);

  const char* raw_threads = std::getenv(kThreadCountEnv.data());
  if (raw_threads == nullptr || *raw_threads == '\0') {
    return bounded_default_threads;
  }

  const auto parsed_threads = ParsePositiveIntegerEnv<std::size_t>(raw_threads);
  if (!parsed_threads.has_value()) {
    std::cerr << "Ignoring invalid DELIVERYOPTIMIZER_THREADS='" << raw_threads << "'. Using "
              << bounded_default_threads << " worker thread(s).\n";
    return bounded_default_threads;
  }

  if (*parsed_threads > kMaxWorkerThreads) {
    std::cerr << "Capping DELIVERYOPTIMIZER_THREADS='" << raw_threads << "' to "
              << kMaxWorkerThreads << " worker thread(s).\n";
    return kMaxWorkerThreads;
  }

  return *parsed_threads;
}

} // namespace

namespace deliveryoptimizer::api {

std::optional<ServerOptions> LoadServerOptionsFromEnv() {
  const auto listen_port = ResolveListenPort();
  if (!listen_port.has_value()) {
    return std::nullopt;
  }

  return ServerOptions{.listen_port = *listen_port, .worker_threads = ResolveThreadCount()};
}

} // namespace deliveryoptimizer::api
