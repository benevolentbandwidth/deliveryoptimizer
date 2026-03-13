#include "deliveryoptimizer/api/endpoints/optimize_endpoint.hpp"

#include "deliveryoptimizer/adapters/routing_facade.hpp"

#include <charconv>
#include <cstddef>
#include <drogon/drogon.h>
#include <optional>
#include <string>
#include <system_error>
#include <utility>

namespace {

constexpr int kDefaultDeliveries = 1;
constexpr int kDefaultVehicles = 1;
constexpr int kMaxDeliveries = 10000;
constexpr int kMaxVehicles = 2000;

[[nodiscard]] std::optional<std::size_t>
ResolveBoundedCount(const std::optional<std::string>& raw_value, const int default_value,
                    const int max_value) {
  int value = default_value;
  if (raw_value.has_value()) {
    const char* begin = raw_value->data();
    const char* end = begin + raw_value->size();
    const auto [parsed_end, error_code] = std::from_chars(begin, end, value);
    if (error_code != std::errc() || parsed_end != end) {
      return std::nullopt;
    }
  }

  if (value <= 0 || value > max_value) {
    return std::nullopt;
  }

  return static_cast<std::size_t>(value);
}

} // namespace

namespace deliveryoptimizer::api {

void RegisterOptimizeEndpoint(drogon::HttpAppFramework& app) {
  app.registerHandler(
      "/optimize",
      [](const drogon::HttpRequestPtr& request,
         std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
        const auto deliveries =
            ResolveBoundedCount(request->getOptionalParameter<std::string>("deliveries"),
                                kDefaultDeliveries, kMaxDeliveries);
        const auto vehicles = ResolveBoundedCount(
            request->getOptionalParameter<std::string>("vehicles"), kDefaultVehicles, kMaxVehicles);
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
        body["summary"] =
            deliveryoptimizer::adapters::Optimize(deliveries.value(), vehicles.value());
        std::move(callback)(drogon::HttpResponse::newHttpJsonResponse(body));
      },
      {drogon::Post});
}

} // namespace deliveryoptimizer::api
