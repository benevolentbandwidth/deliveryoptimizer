#include "deliveryoptimizer/adapters/routing_facade.hpp"

#include <algorithm>
#include <cerrno>
#include <cstdint>
#include <cstdlib>
#include <drogon/drogon.h>
#include <limits>
#include <optional>
#include <thread>
#include <utility>

namespace {

constexpr std::uint16_t kDefaultListenPort = 8080U;
constexpr int kDefaultDeliveries = 1;
constexpr int kDefaultVehicles = 1;
constexpr int kMaxDeliveries = 10000;
constexpr int kMaxVehicles = 2000;
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

[[nodiscard]] std::optional<std::size_t> ResolveBoundedCount(const std::optional<int>& parsed_value,
                                                             const int default_value,
                                                             const int max_value) {
  const int value = parsed_value.value_or(default_value);
  if (value <= 0 || value > max_value) {
    return std::nullopt;
  }

  return static_cast<std::size_t>(value);
}

[[nodiscard]] std::size_t ResolveThreadCount() {
  const auto detected = std::thread::hardware_concurrency();
  const std::size_t default_threads = detected == 0U ? 1U : static_cast<std::size_t>(detected);

  const char* raw_threads = std::getenv("DELIVERYOPTIMIZER_THREADS");
  if (raw_threads == nullptr || *raw_threads == '\0') {
    return default_threads;
  }

  errno = 0;
  char* end = nullptr;
  const long parsed = std::strtol(raw_threads, &end, 10);
  const bool invalid = errno != 0 || end == raw_threads || *end != '\0' || parsed <= 0L;
  if (invalid) {
    return default_threads;
  }

  const auto requested_threads = static_cast<std::size_t>(parsed);
  return std::min(requested_threads, kMaxWorkerThreads);
}

} // namespace

int main() {
  drogon::app().registerHandler(
      "/health", [](const drogon::HttpRequestPtr& /*request*/,
                    std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
        Json::Value body;
        body["status"] = "ok";
        std::move(callback)(drogon::HttpResponse::newHttpJsonResponse(body));
      });

  drogon::app().registerHandler(
      "/optimize", [](const drogon::HttpRequestPtr& request,
                      std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
        const auto deliveries = ResolveBoundedCount(
            request->getOptionalParameter<int>("deliveries"), kDefaultDeliveries, kMaxDeliveries);
        const auto vehicles = ResolveBoundedCount(request->getOptionalParameter<int>("vehicles"),
                                                  kDefaultVehicles, kMaxVehicles);
        if (!deliveries.has_value() || !vehicles.has_value()) {
          Json::Value error_body;
          error_body["error"] = "invalid optimize query params";
          error_body["deliveries_min"] = 1;
          error_body["deliveries_max"] = kMaxDeliveries;
          error_body["vehicles_min"] = 1;
          error_body["vehicles_max"] = kMaxVehicles;
          auto response = drogon::HttpResponse::newHttpJsonResponse(error_body);
          response->setStatusCode(drogon::k400BadRequest);
          std::move(callback)(response);
          return;
        }

        Json::Value body;
        body["summary"] = deliveryoptimizer::adapters::RoutingFacade::Optimize(deliveries.value(),
                                                                               vehicles.value());
        std::move(callback)(drogon::HttpResponse::newHttpJsonResponse(body));
      });

  drogon::app().addListener("0.0.0.0", ResolveListenPort());
  drogon::app().setThreadNum(ResolveThreadCount());
  drogon::app().run();

  return 0;
}
