#include "deliveryoptimizer/api/endpoints/health_endpoint.hpp"

#include <drogon/drogon.h>

namespace deliveryoptimizer::api {

void RegisterHealthEndpoint(drogon::HttpAppFramework& app) {
  app.registerHandler("/health",
                      [](const drogon::HttpRequestPtr& /*request*/,
                         std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
                        Json::Value body;
                        body["status"] = "ok";
                        std::move(callback)(drogon::HttpResponse::newHttpJsonResponse(body));
                      });
}

} // namespace deliveryoptimizer::api
