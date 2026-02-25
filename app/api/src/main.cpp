#include "deliveryoptimizer/adapters/routing_facade.hpp"

#include <drogon/drogon.h>
#include <utility>

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
        const auto deliveries =
            static_cast<std::size_t>(request->getOptionalParameter<int>("deliveries").value_or(1));
        const auto vehicles =
            static_cast<std::size_t>(request->getOptionalParameter<int>("vehicles").value_or(1));

        Json::Value body;
        body["summary"] =
            deliveryoptimizer::adapters::RoutingFacade::Optimize(deliveries, vehicles);
        std::move(callback)(drogon::HttpResponse::newHttpJsonResponse(body));
      });

  drogon::app().addListener("0.0.0.0", 8080);
  drogon::app().setThreadNum(1);
  drogon::app().run();

  return 0;
}
