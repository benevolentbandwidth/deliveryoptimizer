#include "deliveryoptimizer/api/endpoints/deliveries_optimize_endpoint.hpp"

#include "deliveryoptimizer/api/observability.hpp"
#include "deliveryoptimizer/api/optimize_request.hpp"
#include "deliveryoptimizer/api/solve_coordinator.hpp"
#include "deliveryoptimizer/api/solve_execution.hpp"
#include "deliveryoptimizer/api/vroom_runner.hpp"

#include <cstdint>
#include <drogon/drogon.h>
#include <json/json.h>
#include <memory>
#include <string_view>
#include <trantor/net/EventLoop.h>
#include <utility>

namespace {

using deliveryoptimizer::api::OptimizeRequestInput;

struct CompletedResponse {
  drogon::HttpResponsePtr response;
  deliveryoptimizer::api::SolveRequestOutcome outcome;
};

[[nodiscard]] drogon::HttpResponsePtr BuildErrorResponse(const drogon::HttpStatusCode code,
                                                         const std::string_view error_message) {
  Json::Value body{Json::objectValue};
  body["error"] = std::string{error_message};
  auto response = drogon::HttpResponse::newHttpJsonResponse(body);
  response->setStatusCode(code);
  return response;
}

[[nodiscard]] drogon::HttpResponsePtr BuildValidationResponse(const Json::Value& issues) {
  Json::Value body{Json::objectValue};
  body["error"] = "Validation failed.";
  body["issues"] = issues;
  auto response = drogon::HttpResponse::newHttpJsonResponse(body);
  response->setStatusCode(drogon::k400BadRequest);
  return response;
}

[[nodiscard]] CompletedResponse
BuildAdmissionRejectionResponse(const deliveryoptimizer::api::SolveAdmissionStatus status) {
  switch (status) {
  case deliveryoptimizer::api::SolveAdmissionStatus::kRejectedTooManyJobs:
  case deliveryoptimizer::api::SolveAdmissionStatus::kRejectedTooManyVehicles:
    return CompletedResponse{
        .response =
            BuildErrorResponse(drogon::k422UnprocessableEntity,
                               "Routing optimization is unavailable for requests of this size."),
        .outcome = status == deliveryoptimizer::api::SolveAdmissionStatus::kRejectedTooManyJobs
                       ? deliveryoptimizer::api::SolveRequestOutcome::kRejectedTooManyJobs
                       : deliveryoptimizer::api::SolveRequestOutcome::kRejectedTooManyVehicles,
    };
  case deliveryoptimizer::api::SolveAdmissionStatus::kRejectedQueueFull:
    return CompletedResponse{
        .response = BuildErrorResponse(drogon::k503ServiceUnavailable,
                                       "Routing optimization is temporarily overloaded."),
        .outcome = deliveryoptimizer::api::SolveRequestOutcome::kRejectedQueueFull,
    };
  case deliveryoptimizer::api::SolveAdmissionStatus::kAccepted:
    break;
  }

  return CompletedResponse{
      .response = BuildErrorResponse(drogon::k502BadGateway, "Routing optimization failed."),
      .outcome = deliveryoptimizer::api::SolveRequestOutcome::kFailed,
  };
}

[[nodiscard]] CompletedResponse
BuildSolveExecutionResponse(const deliveryoptimizer::api::SolveExecutionResult& result) {
  if (result.response_body.has_value()) {
    auto response = drogon::HttpResponse::newHttpJsonResponse(*result.response_body);
    response->setStatusCode(static_cast<drogon::HttpStatusCode>(result.http_status));
    return CompletedResponse{
        .response = response,
        .outcome = result.outcome,
    };
  }

  return CompletedResponse{
      .response = BuildErrorResponse(static_cast<drogon::HttpStatusCode>(result.http_status),
                                     result.error_message),
      .outcome = result.outcome,
  };
}

void DispatchResponse(
    trantor::EventLoop* response_loop,
    const std::shared_ptr<std::function<void(const drogon::HttpResponsePtr&)>>& callback,
    const drogon::HttpResponsePtr& response) {
  response_loop->queueInLoop([callback, response] { (*callback)(response); });
}

} // namespace

namespace deliveryoptimizer::api {

void RegisterDeliveriesOptimizeEndpoint(drogon::HttpAppFramework& app,
                                        const SolveAdmissionConfig& admission_config,
                                        std::shared_ptr<ObservabilityRegistry> observability) {
  auto coordinator = std::make_shared<SolveCoordinator>(
      admission_config, std::make_shared<ProcessVroomRunner>(ResolveVroomRuntimeConfigFromEnv()),
      SolveCoordinatorOptions{}, observability);

  app.registerHandler(
      "/api/v1/deliveries/optimize",
      [coordinator = std::move(coordinator), observability = std::move(observability)](
          const drogon::HttpRequestPtr& request,
          std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
        auto lifecycle = std::make_shared<SolveLifecycle>(CreateSolveLifecycle(request));
        auto response_callback =
            std::make_shared<std::function<void(const drogon::HttpResponsePtr&)>>(
                std::move(callback));
        trantor::EventLoop* response_loop = trantor::EventLoop::getEventLoopOfCurrentThread();
        if (response_loop == nullptr) {
          response_loop = drogon::app().getLoop();
        }

        const auto respond = [response_callback,
                              response_loop](const drogon::HttpResponsePtr& response) {
          DispatchResponse(response_loop, response_callback, response);
        };
        const auto respond_with_completion =
            [respond, observability, lifecycle](const CompletedResponse& completed_response) {
              FinalizeSolveRequest(
                  observability, lifecycle, completed_response.outcome,
                  static_cast<std::uint16_t>(completed_response.response->getStatusCode()));
              respond(completed_response.response);
            };

        const auto& parsed_json = request->getJsonObject();
        if (!parsed_json) {
          respond_with_completion(CompletedResponse{
              .response =
                  BuildErrorResponse(drogon::k400BadRequest, "Request body must be valid JSON."),
              .outcome = SolveRequestOutcome::kInvalidJson,
          });
          return;
        }

        const auto early_request_size = TryParseOptimizeRequestSize(*parsed_json);
        if (early_request_size.has_value()) {
          lifecycle->jobs = early_request_size->jobs;
          lifecycle->vehicles = early_request_size->vehicles;
          const SolveAdmissionStatus admission_status =
              coordinator->CheckAdmission(*early_request_size, lifecycle);
          if (admission_status != SolveAdmissionStatus::kAccepted) {
            respond_with_completion(BuildAdmissionRejectionResponse(admission_status));
            return;
          }
        }

        Json::Value issues{Json::arrayValue};
        auto parsed_request = ParseAndValidateOptimizeRequest(*parsed_json, issues);
        if (!parsed_request.has_value()) {
          respond_with_completion(CompletedResponse{
              .response = BuildValidationResponse(issues),
              .outcome = SolveRequestOutcome::kValidationFailed,
          });
          return;
        }

        auto optimize_request_ptr =
            std::make_shared<OptimizeRequestInput>(std::move(parsed_request->input));
        lifecycle->jobs = optimize_request_ptr->jobs.size();
        lifecycle->vehicles = optimize_request_ptr->vehicles.size();

        const SolveRequestSize request_size{
            .jobs = optimize_request_ptr->jobs.size(),
            .vehicles = optimize_request_ptr->vehicles.size(),
        };

        const SolveAdmissionStatus admission_status = coordinator->Submit(
            request_size, [optimize_request_ptr] { return BuildVroomInput(*optimize_request_ptr); },
            [optimize_request_ptr,
             respond_with_completion](const CoordinatedSolveResult& result) mutable {
              respond_with_completion(BuildSolveExecutionResponse(
                  BuildSolveExecutionResult(*optimize_request_ptr, result)));
            },
            lifecycle);
        if (admission_status != SolveAdmissionStatus::kAccepted) {
          respond_with_completion(BuildAdmissionRejectionResponse(admission_status));
        }
      },
      {drogon::Post});
}

} // namespace deliveryoptimizer::api
