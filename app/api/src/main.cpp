#include "deliveryoptimizer/adapters/routing_facade.hpp"

#include <drogon/drogon.h>

namespace {

deliveryoptimizer::adapters::RoutingFacade kRoutingFacade;

} // namespace

int main() {
  drogon::app().registerHandler("/health",
                                [](const drogon::HttpRequestPtr& /*request*/,
                                   std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
                                  Json::Value body;
                                  body["status"] = "ok";
                                  callback(drogon::HttpResponse::newHttpJsonResponse(body));
                                });

  drogon::app().registerHandler(
      "/optimize", [](const drogon::HttpRequestPtr& request,
                      std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
        const auto deliveries =
            static_cast<std::size_t>(request->getOptionalParameter<int>("deliveries").value_or(1));
        const auto vehicles =
            static_cast<std::size_t>(request->getOptionalParameter<int>("vehicles").value_or(1));

        Json::Value body;
        body["summary"] = kRoutingFacade.Optimize(deliveries, vehicles);
        callback(drogon::HttpResponse::newHttpJsonResponse(body));
      });

  drogon::app().addListener("0.0.0.0", 8080);
  drogon::app().setThreadNum(1);
  drogon::app().run();

  return 0;
}
