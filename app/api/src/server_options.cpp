#include "deliveryoptimizer/api/server_options.hpp"

#include "deliveryoptimizer/api/deliveries_optimize_limits.hpp"

#include <algorithm>
#include <charconv>
#include <chrono>
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
constexpr std::string_view kEnableMetricsEnv = "DELIVERYOPTIMIZER_ENABLE_METRICS";
constexpr std::string_view kSolverMaxConcurrencyEnv = "DELIVERYOPTIMIZER_SOLVER_MAX_CONCURRENCY";
constexpr std::string_view kSolverMaxQueueSizeEnv = "DELIVERYOPTIMIZER_SOLVER_MAX_QUEUE_SIZE";
constexpr std::string_view kSolverQueueWaitMsEnv = "DELIVERYOPTIMIZER_SOLVER_QUEUE_WAIT_MS";
constexpr std::string_view kSolverMaxSyncJobsEnv = "DELIVERYOPTIMIZER_SOLVER_MAX_SYNC_JOBS";
constexpr std::string_view kSolverMaxSyncVehiclesEnv = "DELIVERYOPTIMIZER_SOLVER_MAX_SYNC_VEHICLES";
constexpr std::size_t kDefaultSolverMaxConcurrencyCap = 4U;
constexpr std::size_t kDefaultSolverQueueSizePerWorker = 4U;
constexpr std::uint64_t kDefaultSolverQueueWaitMs = 1000U;
constexpr std::size_t kDefaultSolverMaxSyncJobs = 10000U;
constexpr std::size_t kDefaultSolverMaxSyncVehicles = 2000U;

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

[[nodiscard]] std::uint16_t ResolveListenPort() {
  const char* raw_port = std::getenv(kListenPortEnv.data());
  if (raw_port == nullptr || *raw_port == '\0') {
    return kDefaultListenPort;
  }

  const auto parsed_port = ParsePositiveIntegerEnv<std::uint32_t>(raw_port);
  if (!parsed_port.has_value() ||
      *parsed_port > static_cast<std::uint32_t>(std::numeric_limits<std::uint16_t>::max())) {
    std::cerr << "Ignoring invalid DELIVERYOPTIMIZER_PORT='" << raw_port << "'. Using default port "
              << kDefaultListenPort << ".\n";
    return kDefaultListenPort;
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

template <typename Integer>
[[nodiscard]] std::optional<Integer> ParseNonNegativeIntegerEnv(const char* raw_value) {
  if (raw_value == nullptr || *raw_value == '\0') {
    return std::nullopt;
  }

  const std::string_view value_text{raw_value};
  Integer parsed_value = 0;
  const auto [end_ptr, error] =
      std::from_chars(value_text.data(), value_text.data() + value_text.size(), parsed_value);

  if (error != std::errc{} || end_ptr != value_text.data() + value_text.size()) {
    return std::nullopt;
  }

  return parsed_value;
}

[[nodiscard]] bool ResolveMetricsEnabled() {
  const char* raw_value = std::getenv(kEnableMetricsEnv.data());
  if (raw_value == nullptr || *raw_value == '\0') {
    return false;
  }

  const auto parsed_value = ParseNonNegativeIntegerEnv<unsigned int>(raw_value);
  if (!parsed_value.has_value() || *parsed_value > 1U) {
    std::cerr << "Ignoring invalid " << kEnableMetricsEnv << "='" << raw_value
              << "'. Using metrics-disabled default.\n";
    return false;
  }

  return *parsed_value == 1U;
}

[[nodiscard]] std::size_t ResolvePositiveSizeOption(const std::string_view env_name,
                                                    const std::size_t default_value,
                                                    const std::string_view description) {
  const char* raw_value = std::getenv(env_name.data());
  if (raw_value == nullptr || *raw_value == '\0') {
    return default_value;
  }

  const auto parsed_value = ParsePositiveIntegerEnv<std::size_t>(raw_value);
  if (!parsed_value.has_value()) {
    std::cerr << "Ignoring invalid " << env_name << "='" << raw_value << "'. Using default "
              << description << ' ' << default_value << ".\n";
    return default_value;
  }

  return *parsed_value;
}

[[nodiscard]] std::size_t ResolveClampedPositiveSizeOption(const std::string_view env_name,
                                                           const std::size_t default_value,
                                                           const std::size_t max_value,
                                                           const std::string_view description) {
  const std::size_t resolved_value =
      ResolvePositiveSizeOption(env_name, default_value, description);
  if (resolved_value <= max_value) {
    return resolved_value;
  }

  std::cerr << "Capping " << env_name << "='" << resolved_value << "' to " << max_value
            << " because the deliveries optimize request parser does not accept larger "
            << description << " values.\n";
  return max_value;
}

[[nodiscard]] std::size_t ResolveNonNegativeSizeOption(const std::string_view env_name,
                                                       const std::size_t default_value,
                                                       const std::string_view description) {
  const char* raw_value = std::getenv(env_name.data());
  if (raw_value == nullptr || *raw_value == '\0') {
    return default_value;
  }

  const auto parsed_value = ParseNonNegativeIntegerEnv<std::size_t>(raw_value);
  if (!parsed_value.has_value()) {
    std::cerr << "Ignoring invalid " << env_name << "='" << raw_value << "'. Using default "
              << description << ' ' << default_value << ".\n";
    return default_value;
  }

  return *parsed_value;
}

[[nodiscard]] std::chrono::milliseconds ResolveQueueWaitTimeout() {
  const std::size_t timeout_ms = ResolveNonNegativeSizeOption(
      kSolverQueueWaitMsEnv, static_cast<std::size_t>(kDefaultSolverQueueWaitMs),
      "solver queue wait timeout (ms)");
  const auto max_queue_wait_timeout = std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::steady_clock::duration::max());
  const std::uint64_t max_timeout_ms = static_cast<std::uint64_t>(max_queue_wait_timeout.count());
  if (static_cast<std::uint64_t>(timeout_ms) > max_timeout_ms) {
    std::cerr << "Capping " << kSolverQueueWaitMsEnv << "='" << timeout_ms << "' to "
              << max_timeout_ms << " because larger solver queue wait timeout (ms) values "
              << "overflow the solver deadline clock.\n";
    return max_queue_wait_timeout;
  }

  return std::chrono::milliseconds{
      static_cast<std::chrono::milliseconds::rep>(static_cast<std::uint64_t>(timeout_ms))};
}

[[nodiscard]] std::size_t ResolveSolverMaxConcurrency(const std::size_t worker_threads) {
  const std::size_t default_max_concurrency =
      std::clamp(worker_threads, static_cast<std::size_t>(1U), kDefaultSolverMaxConcurrencyCap);
  const std::size_t max_concurrency = ResolvePositiveSizeOption(
      kSolverMaxConcurrencyEnv, default_max_concurrency, "solver max concurrency");
  if (max_concurrency <= kMaxWorkerThreads) {
    return max_concurrency;
  }

  std::cerr << "Capping " << kSolverMaxConcurrencyEnv << "='" << max_concurrency << "' to "
            << kMaxWorkerThreads
            << " because the server does not support more than 64 solver worker thread(s).\n";
  return kMaxWorkerThreads;
}

[[nodiscard]] deliveryoptimizer::api::SolveAdmissionConfig
ResolveSolveAdmissionConfig(const std::size_t worker_threads) {
  const std::size_t max_concurrency = ResolveSolverMaxConcurrency(worker_threads);
  const std::size_t default_max_queue_size = max_concurrency * kDefaultSolverQueueSizePerWorker;

  return deliveryoptimizer::api::SolveAdmissionConfig{
      .max_concurrency = max_concurrency,
      .max_queue_size = ResolveNonNegativeSizeOption(kSolverMaxQueueSizeEnv, default_max_queue_size,
                                                     "solver queue size"),
      .max_queue_wait = ResolveQueueWaitTimeout(),
      .max_sync_jobs = ResolveClampedPositiveSizeOption(
          kSolverMaxSyncJobsEnv, kDefaultSolverMaxSyncJobs,
          deliveryoptimizer::api::kMaxDeliveriesOptimizeJobs, "solver max synchronous jobs"),
      .max_sync_vehicles =
          ResolveClampedPositiveSizeOption(kSolverMaxSyncVehiclesEnv, kDefaultSolverMaxSyncVehicles,
                                           deliveryoptimizer::api::kMaxDeliveriesOptimizeVehicles,
                                           "solver max synchronous vehicles"),
  };
}

} // namespace

namespace deliveryoptimizer::api {

ServerOptions LoadServerOptionsFromEnv() {
  const std::size_t worker_threads = ResolveThreadCount();
  return ServerOptions{
      .listen_port = ResolveListenPort(),
      .worker_threads = worker_threads,
      .enable_metrics = ResolveMetricsEnabled(),
      .solve_admission = ResolveSolveAdmissionConfig(worker_threads),
  };
}

} // namespace deliveryoptimizer::api
