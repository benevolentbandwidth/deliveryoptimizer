#include "deliveryoptimizer/adapters/routing_facade.hpp"

#include <cstddef>
#include <drogon/drogon.h>
#include <thread>
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
      "/optimize",
      [](const drogon::HttpRequestPtr& request,
         std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
        const int deliveries_param = request->getOptionalParameter<int>("deliveries").value_or(1);
        const int vehicles_param = request->getOptionalParameter<int>("vehicles").value_or(1);

        if (deliveries_param < 0 || vehicles_param < 0) {
          Json::Value error_body;
          error_body["error"] =
              "Query parameters 'deliveries' and 'vehicles' must be non-negative integers.";
          auto response = drogon::HttpResponse::newHttpJsonResponse(error_body);
          response->setStatusCode(drogon::k400BadRequest);
          std::move(callback)(response);
          return;
        }

        const auto deliveries = static_cast<std::size_t>(deliveries_param);
        const auto vehicles = static_cast<std::size_t>(vehicles_param);

        Json::Value body;
        body["summary"] =
            deliveryoptimizer::adapters::RoutingFacade::Optimize(deliveries, vehicles);
        std::move(callback)(drogon::HttpResponse::newHttpJsonResponse(body));
      },
      {drogon::Post});

  drogon::app().addListener("0.0.0.0", 8080);
  const unsigned int detected_threads = std::thread::hardware_concurrency();
  const unsigned int thread_count = detected_threads == 0U ? 1U : detected_threads;
  drogon::app().setThreadNum(thread_count);
  drogon::app().run();

  return 0;
}
