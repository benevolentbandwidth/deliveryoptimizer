#include "deliveryoptimizer/api/api_server.hpp"

#include "deliveryoptimizer/api/endpoints/deliveries_optimize_endpoint.hpp"
#include "deliveryoptimizer/api/endpoints/health_endpoint.hpp"
#include "deliveryoptimizer/api/endpoints/metrics_endpoint.hpp"
#include "deliveryoptimizer/api/endpoints/optimization_jobs_endpoint.hpp"
#include "deliveryoptimizer/api/endpoints/optimize_endpoint.hpp"
#include "deliveryoptimizer/api/endpoints/osrm_proxy_endpoint.hpp"
#include "deliveryoptimizer/api/optimization_job_runtime.hpp"
#include "deliveryoptimizer/api/optimization_job_store.hpp"
#include "deliveryoptimizer/api/observability.hpp"
#include "deliveryoptimizer/api/server_options.hpp"
#include "deliveryoptimizer/api/vroom_runner.hpp"

#include <chrono>
#include <drogon/drogon.h>
#include <type_traits>

namespace {

constexpr std::size_t kMaxRequestBodyBytes = 10U * 1024U * 1024U;
constexpr std::size_t kParserMaxRequestBodyBytes = 12U * 1024U * 1024U;

[[nodiscard]] std::string GenerateRequestId() {
  return drogon::utils::getUuid();
}

template <typename ErrorHandler>
[[nodiscard]] drogon::HttpResponsePtr InvokeErrorHandler(const ErrorHandler& handler,
                                                         const drogon::HttpStatusCode code) {
  if constexpr (std::is_invocable_v<ErrorHandler, drogon::HttpStatusCode>) {
    return handler(code);
  } else {
    return handler(code, nullptr);
  }
}

} // namespace

namespace deliveryoptimizer::api {

int RunApiServer() {
  auto& app = drogon::app();
  const auto options = LoadServerOptionsFromEnv();
  auto observability = std::make_shared<ObservabilityRegistry>();
  auto job_store = std::make_shared<OptimizationJobStore>(options.optimization_jobs);
  auto job_runtime = std::make_shared<OptimizationJobRuntime>(
      job_store, std::make_shared<ProcessVroomRunner>(ResolveVroomRuntimeConfigFromEnv()),
      observability, options.optimization_job_runtime);
  const auto default_error_handler = app.getCustomErrorHandler();

  app.registerHttpResponseCreationAdvice([](const drogon::HttpResponsePtr& response) {
    if (response == nullptr || !response->getHeader(std::string{kRequestIdHeader}).empty()) {
      return;
    }

    response->addHeader(std::string{kRequestIdHeader}, GenerateRequestId());
  });
  app.setCustomErrorHandler([default_error_handler](const drogon::HttpStatusCode code) {
    auto response = InvokeErrorHandler(default_error_handler, code);
    if (response == nullptr) {
      return response;
    }

    if (response->getHeader(std::string{kRequestIdHeader}).empty()) {
      response->addHeader(std::string{kRequestIdHeader}, GenerateRequestId());
    }
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
          (request->path() == "/api/v1/deliveries/optimize" ||
           request->path() == "/api/v1/optimization-jobs")) {
        auto lifecycle = std::make_shared<SolveLifecycle>(CreateSolveLifecycle(request));
        FinalizeSolveRequest(observability, lifecycle, SolveRequestOutcome::kRequestTooLarge,
                             static_cast<std::uint16_t>(response->getStatusCode()));
      }
      return response;
    }
    return drogon::HttpResponsePtr{};
  });
  app.registerPreSendingAdvice(
      [](const drogon::HttpRequestPtr& request, const drogon::HttpResponsePtr& response) {
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

  RegisterHealthEndpoint(
      app, observability,
      [job_store, job_runtime](Json::Value& checks, bool& overall_ready) {
        if (job_store == nullptr || !job_store->IsConfigured()) {
          checks["optimization_jobs_db"] = "missing";
          checks["optimization_jobs_db_detail"] = "missing database connection string";
          checks["optimization_job_workers_expected"] =
              static_cast<Json::UInt64>(job_runtime == nullptr ? 0U : job_runtime->ExpectedWorkerCount());
          checks["optimization_job_workers_healthy"] = 0U;
          overall_ready = false;
          return;
        }

        std::string detail;
        const bool db_ready = job_store->Ping(&detail);
        const auto stats = job_runtime == nullptr ? OptimizationJobStoreStats{}
                                                  : job_runtime->CurrentStats();
        const std::size_t expected_workers =
            job_runtime == nullptr ? 0U : job_runtime->ExpectedWorkerCount();
        const std::size_t healthy_workers =
            job_runtime == nullptr ? 0U : job_runtime->HealthyWorkerCount();
        const bool schema_ready = job_runtime != nullptr && job_runtime->IsSchemaReady();
        const std::string schema_detail =
            job_runtime == nullptr ? "missing optimization job runtime"
                                   : job_runtime->SchemaStatusDetail();
        checks["optimization_jobs_db"] = db_ready ? "ok" : "down";
        checks["optimization_jobs_db_detail"] = detail;
        checks["optimization_jobs_schema"] = schema_ready ? "ok" : "down";
        checks["optimization_jobs_schema_detail"] = schema_detail;
        checks["optimization_job_workers_expected"] = static_cast<Json::UInt64>(expected_workers);
        checks["optimization_job_workers_healthy"] = static_cast<Json::UInt64>(healthy_workers);
        checks["optimization_job_queue_depth"] = static_cast<Json::UInt64>(stats.queued_jobs);
        checks["optimization_job_running"] = static_cast<Json::UInt64>(stats.running_jobs);
        if (!db_ready || !schema_ready ||
            (expected_workers > 0U && healthy_workers < expected_workers)) {
          overall_ready = false;
        }
      });
  if (options.enable_metrics) {
    RegisterMetricsEndpoint(app, observability);
  }
  RegisterOptimizeEndpoint(app);
  RegisterOptimizationJobsEndpoints(app, job_store, job_runtime, observability);
  if (options.enable_sync_optimize) {
    RegisterDeliveriesOptimizeEndpoint(app, options.solve_admission, observability);
  }
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
