#include "deliveryoptimizer/api/endpoints/metrics_endpoint.hpp"

#include "deliveryoptimizer/api/observability.hpp"

#include <drogon/drogon.h>
#include <utility>

namespace deliveryoptimizer::api {

void RegisterMetricsEndpoint(drogon::HttpAppFramework& app,
                             std::shared_ptr<ObservabilityRegistry> observability) {
  app.registerHandler("/metrics",
                      [observability = std::move(observability)](
                          const drogon::HttpRequestPtr& /*request*/,
                          std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
                        auto response = drogon::HttpResponse::newHttpResponse();
                        response->setStatusCode(drogon::k200OK);
                        response->setContentTypeString("text/plain; version=0.0.4; charset=utf-8");
                        response->setBody(observability->RenderPrometheusText());
                        std::move(callback)(response);
                      },
                      {drogon::Get});
}

} // namespace deliveryoptimizer::api
