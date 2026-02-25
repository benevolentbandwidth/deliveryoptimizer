#include "deliveryoptimizer/api/endpoints/optimize_endpoint.hpp"

#include "deliveryoptimizer/adapters/routing_facade.hpp"

#include <cstddef>
#include <drogon/drogon.h>
#include <optional>
#include <utility>

namespace {

constexpr int kDefaultDeliveries = 1;
constexpr int kDefaultVehicles = 1;
constexpr int kMaxDeliveries = 10000;
constexpr int kMaxVehicles = 2000;

[[nodiscard]] std::optional<std::size_t> ResolveBoundedCount(const std::optional<int>& parsed_value,
                                                             const int default_value,
                                                             const int max_value) {
  const int value = parsed_value.value_or(default_value);
  if (value <= 0 || value > max_value) {
    return std::nullopt;
  }

  return static_cast<std::size_t>(value);
}

} // namespace

namespace deliveryoptimizer::api {

void RegisterOptimizeEndpoint(drogon::HttpAppFramework& app) {
  app.registerHandler(
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
}

} // namespace deliveryoptimizer::api
