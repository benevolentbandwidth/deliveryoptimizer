#include "deliveryoptimizer/api/endpoints/optimization_jobs_endpoint.hpp"

#include "deliveryoptimizer/api/observability.hpp"
#include "deliveryoptimizer/api/optimization_job_runtime.hpp"
#include "deliveryoptimizer/api/optimization_job_store.hpp"
#include "deliveryoptimizer/api/optimize_request.hpp"

#include <drogon/drogon.h>
#include <json/json.h>

#include <memory>
#include <string>
#include <string_view>

namespace {

[[nodiscard]] drogon::HttpResponsePtr BuildJsonResponse(const Json::Value& body,
                                                        const drogon::HttpStatusCode code) {
  auto response = drogon::HttpResponse::newHttpJsonResponse(body);
  response->setStatusCode(code);
  return response;
}

[[nodiscard]] drogon::HttpResponsePtr BuildErrorResponse(const drogon::HttpStatusCode code,
                                                         const std::string_view error_message) {
  Json::Value body{Json::objectValue};
  body["error"] = std::string{error_message};
  return BuildJsonResponse(body, code);
}

[[nodiscard]] drogon::HttpResponsePtr BuildValidationResponse(const Json::Value& issues) {
  Json::Value body{Json::objectValue};
  body["error"] = "Validation failed.";
  body["issues"] = issues;
  return BuildJsonResponse(body, drogon::k400BadRequest);
}

[[nodiscard]] Json::Value BuildJobUrls(const std::string& job_id) {
  Json::Value urls{Json::objectValue};
  urls["status"] = "/api/v1/optimization-jobs/" + job_id;
  urls["result"] = "/api/v1/optimization-jobs/" + job_id + "/result";
  return urls;
}

[[nodiscard]] Json::Value BuildJobStatusBody(const deliveryoptimizer::api::OptimizationJobRecord& job) {
  Json::Value body{Json::objectValue};
  body["job_id"] = job.job_id;
  body["request_id"] = job.request_id;
  body["status"] = std::string{deliveryoptimizer::api::ToOptimizationJobStateString(job.state)};
  body["jobs"] = static_cast<Json::UInt64>(job.jobs);
  body["vehicles"] = static_cast<Json::UInt64>(job.vehicles);
  body["queued_at"] = job.queued_at;
  if (job.started_at.has_value()) {
    body["started_at"] = *job.started_at;
  }
  if (job.completed_at.has_value()) {
    body["completed_at"] = *job.completed_at;
  }
  if (job.expires_at.has_value()) {
    body["expires_at"] = *job.expires_at;
  }
  if (job.outcome.has_value()) {
    body["outcome"] = std::string{deliveryoptimizer::api::ToOutcomeString(*job.outcome)};
  }
  if (job.http_status.has_value()) {
    body["http_status"] = *job.http_status;
  }
  if (job.error_message.has_value()) {
    body["error"] = *job.error_message;
  }
  body["urls"] = BuildJobUrls(job.job_id);
  return body;
}

[[nodiscard]] std::string RenderJson(const Json::Value& value) {
  Json::StreamWriterBuilder writer_builder;
  writer_builder["indentation"] = "";
  writer_builder["commentStyle"] = "None";
  return Json::writeString(writer_builder, value);
}

} // namespace

namespace deliveryoptimizer::api {

void RegisterOptimizationJobsEndpoints(drogon::HttpAppFramework& app,
                                       std::shared_ptr<OptimizationJobStore> store,
                                       std::shared_ptr<OptimizationJobRuntime> runtime,
                                       std::shared_ptr<ObservabilityRegistry> observability) {
  app.registerHandler(
      "/api/v1/optimization-jobs",
      [store, runtime, observability](const drogon::HttpRequestPtr& request,
                                      std::function<void(const drogon::HttpResponsePtr&)>&&
                                          callback) {
        auto lifecycle = std::make_shared<SolveLifecycle>(CreateSolveLifecycle(request));

        if (store == nullptr || runtime == nullptr || !store->IsConfigured() ||
            !runtime->IsSchemaReady()) {
          FinalizeSolveRequest(observability, lifecycle, SolveRequestOutcome::kFailed, 503U);
          std::move(callback)(BuildErrorResponse(drogon::k503ServiceUnavailable,
                                                 "Optimization jobs are not configured."));
          return;
        }

        const auto& parsed_json = request->getJsonObject();
        if (!parsed_json) {
          FinalizeSolveRequest(observability, lifecycle, SolveRequestOutcome::kInvalidJson, 400U);
          std::move(callback)(
              BuildErrorResponse(drogon::k400BadRequest, "Request body must be valid JSON."));
          return;
        }

        Json::Value issues{Json::arrayValue};
        auto parsed_request = ParseAndValidateOptimizeRequest(*parsed_json, issues);
        if (!parsed_request.has_value()) {
          FinalizeSolveRequest(observability, lifecycle, SolveRequestOutcome::kValidationFailed,
                               400U);
          std::move(callback)(BuildValidationResponse(issues));
          return;
        }

        lifecycle->jobs = parsed_request->size.jobs;
        lifecycle->vehicles = parsed_request->size.vehicles;
        const auto context = GetRequestContext(request).value_or(RequestContext{
            .request_id = lifecycle->request_id,
            .started_at = lifecycle->request_started_at,
        });
        const auto created_job = store->CreateJob(context.request_id, RenderJson(*parsed_json),
                                                  parsed_request->size.jobs,
                                                  parsed_request->size.vehicles);
        if (!created_job.has_value()) {
          FinalizeSolveRequest(observability, lifecycle, SolveRequestOutcome::kFailed, 503U);
          std::move(callback)(BuildErrorResponse(
              drogon::k503ServiceUnavailable, "Optimization job submission failed."));
          return;
        }

        FinalizeSolveRequest(observability, lifecycle, SolveRequestOutcome::kSucceeded, 202U);
        Json::Value body = BuildJobStatusBody(*created_job);
        auto response = BuildJsonResponse(body, drogon::k202Accepted);
        response->addHeader("Location", "/api/v1/optimization-jobs/" + created_job->job_id);
        std::move(callback)(response);
      },
      {drogon::Post});

  app.registerHandlerViaRegex(
      "^/api/v1/optimization-jobs/([A-Za-z0-9-]+)/result$",
      [store = store](const drogon::HttpRequestPtr& /*request*/,
                      std::function<void(const drogon::HttpResponsePtr&)>&& callback,
                      const std::string& job_id) {
        if (store == nullptr || !store->IsConfigured()) {
          std::move(callback)(BuildErrorResponse(drogon::k503ServiceUnavailable,
                                                 "Optimization jobs are not configured."));
          return;
        }

        const auto job = store->GetJob(job_id);
        if (!job.has_value() || job->state == OptimizationJobState::kExpired) {
          std::move(callback)(
              BuildErrorResponse(drogon::k404NotFound, "Optimization job not found."));
          return;
        }

        if (job->result_body.has_value()) {
          std::move(callback)(BuildJsonResponse(*job->result_body, drogon::k200OK));
          return;
        }

        Json::Value body = BuildJobStatusBody(*job);
        std::move(callback)(BuildJsonResponse(body, drogon::k409Conflict));
      },
      {drogon::Get});

  app.registerHandlerViaRegex(
      "^/api/v1/optimization-jobs/([A-Za-z0-9-]+)$",
      [store = store](const drogon::HttpRequestPtr& /*request*/,
                      std::function<void(const drogon::HttpResponsePtr&)>&& callback,
                      const std::string& job_id) {
        if (store == nullptr || !store->IsConfigured()) {
          std::move(callback)(BuildErrorResponse(drogon::k503ServiceUnavailable,
                                                 "Optimization jobs are not configured."));
          return;
        }

        const auto job = store->GetJob(job_id);
        if (!job.has_value()) {
          std::move(callback)(
              BuildErrorResponse(drogon::k404NotFound, "Optimization job not found."));
          return;
        }

        std::move(callback)(BuildJsonResponse(BuildJobStatusBody(*job), drogon::k200OK));
      },
      {drogon::Get});
}

} // namespace deliveryoptimizer::api
