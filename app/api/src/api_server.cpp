#include "deliveryoptimizer/api/api_server.hpp"

#include "deliveryoptimizer/api/endpoints/deliveries_optimize_endpoint.hpp"
#include "deliveryoptimizer/api/endpoints/health_endpoint.hpp"
#include "deliveryoptimizer/api/endpoints/metrics_endpoint.hpp"
#include "deliveryoptimizer/api/endpoints/optimize_endpoint.hpp"
#include "deliveryoptimizer/api/endpoints/osrm_proxy_endpoint.hpp"
#include "deliveryoptimizer/api/observability.hpp"
#include "deliveryoptimizer/api/server_options.hpp"

#include <drogon/drogon.h>

#include <chrono>

namespace {

constexpr std::size_t kMaxRequestBodyBytes = 10U * 1024U * 1024U;
constexpr std::size_t kParserMaxRequestBodyBytes = 12U * 1024U * 1024U;

} // namespace

namespace deliveryoptimizer::api {

int RunApiServer() {
  auto& app = drogon::app();
  const auto options = LoadServerOptionsFromEnv();
  auto observability = std::make_shared<ObservabilityRegistry>();
  const auto default_error_handler = app.getCustomErrorHandler();

  app.registerHttpResponseCreationAdvice([](const drogon::HttpResponsePtr& response) {
    if (response == nullptr || !response->getHeader(std::string{kRequestIdHeader}).empty()) {
      return;
    }

    response->addHeader(std::string{kRequestIdHeader}, drogon::utils::getUuid(true));
  });
  app.setCustomErrorHandler(
      [default_error_handler](const drogon::HttpStatusCode code,
                              const drogon::HttpRequestPtr& request) {
        if (request != nullptr) {
          EnsureRequestContext(request);
        }

        auto response = default_error_handler(code, request);
        if (response == nullptr) {
          return response;
        }

        const std::string request_id =
            request == nullptr
                ? drogon::utils::getUuid(true)
                : GetRequestContext(request).value_or(RequestContext{
                      .request_id = drogon::utils::getUuid(true),
                      .started_at = std::chrono::steady_clock::now(),
                  }).request_id;
        response->removeHeader(std::string{kRequestIdHeader});
        response->addHeader(std::string{kRequestIdHeader}, request_id);
        return response;
      });
  app.registerSyncAdvice([observability](const drogon::HttpRequestPtr& request) {
    EnsureRequestContext(request);
    if (request != nullptr && request->body().size() > kMaxRequestBodyBytes) {
      auto response = drogon::HttpResponse::newHttpResponse();
      response->setStatusCode(drogon::k413RequestEntityTooLarge);
      if (const auto context = GetRequestContext(request); context.has_value()) {
        response->removeHeader(std::string{kRequestIdHeader});
        response->addHeader(std::string{kRequestIdHeader}, context->request_id);
      }
      if (request->getMethod() == drogon::Post &&
          request->path() == "/api/v1/deliveries/optimize") {
        auto lifecycle = std::make_shared<SolveLifecycle>(CreateSolveLifecycle(request));
        FinalizeSolveRequest(observability, lifecycle, SolveRequestOutcome::kRequestTooLarge,
                             static_cast<std::uint16_t>(response->getStatusCode()));
      }
      return response;
    }
    return drogon::HttpResponsePtr{};
  });
  app.registerPreSendingAdvice([](const drogon::HttpRequestPtr& request,
                                  const drogon::HttpResponsePtr& response) {
    if (request == nullptr || response == nullptr) {
      return;
    }

    const auto context = GetRequestContext(request);
    if (!context.has_value()) {
      return;
    }

    response->removeHeader(std::string{kRequestIdHeader});
    response->addHeader(std::string{kRequestIdHeader}, context->request_id);
  });

  RegisterHealthEndpoint(app);
  RegisterMetricsEndpoint(app, observability);
  RegisterOptimizeEndpoint(app);
  RegisterDeliveriesOptimizeEndpoint(app, options.solve_admission, observability);
  RegisterOsrmProxyEndpoint(app);

  app.addListener("0.0.0.0", options.listen_port);
  // Parser-generated 413 responses bypass request/response advices, so we keep a
  // small headroom above the 10 MiB application limit: slightly oversized
  // requests still reach sync advice and get X-Request-Id, while very large
  // uploads are rejected before Drogon buffers the full body.
  app.setClientMaxBodySize(kParserMaxRequestBodyBytes);
  app.setThreadNum(options.worker_threads);
  app.run();

  return 0;
}

} // namespace deliveryoptimizer::api
