#include "deliveryoptimizer/api/endpoints/deliveries_optimize_endpoint.hpp"

#include "deliveryoptimizer/api/forecast_optimizer.hpp"
#include "deliveryoptimizer/api/internal/json_utils.hpp"
#include "deliveryoptimizer/api/observability.hpp"
#include "deliveryoptimizer/api/optimize_request.hpp"
#include "deliveryoptimizer/api/solve_coordinator.hpp"
#include "deliveryoptimizer/api/solve_execution.hpp"
#include "deliveryoptimizer/api/vroom_runner.hpp"

#include <atomic>
#include <drogon/drogon.h>
#include <json/json.h>
#include <memory>
#include <optional>
#include <string_view>
#include <trantor/net/EventLoop.h>
#include <utility>

namespace {

struct CompletedResponse {
  drogon::HttpResponsePtr response;
  deliveryoptimizer::api::SolveRequestOutcome outcome;
};

// One shared request aggregate owns all state crossing worker/event-loop
// boundaries. Factories and completion callbacks capture only its shared_ptr,
// avoiding separate allocations for request input, lifecycle, response callback,
// and oversized std::function closures.
struct SyncSolveContext {
  std::shared_ptr<deliveryoptimizer::api::SolveCoordinator> coordinator;
  std::optional<deliveryoptimizer::api::OptimizeRequestInput> optimize_request;
  std::shared_ptr<const deliveryoptimizer::api::WeatherForecastOptions> weather_options;
  std::shared_ptr<const deliveryoptimizer::api::TrafficForecastOptions> traffic_options;
  std::shared_ptr<deliveryoptimizer::api::ObservabilityRegistry> observability;
  deliveryoptimizer::api::SolveLifecycle lifecycle;
  std::function<void(const drogon::HttpResponsePtr&)> response_callback;
  drogon::HttpResponsePtr pending_response;
  trantor::EventLoop* response_loop{nullptr};
  // Guards against double completion: response_callback is moved out on the
  // event loop, so a second invocation would otherwise call an empty
  // std::function and terminate the process.
  std::atomic<bool> responded{false};
  std::optional<Json::Value> forecast;
  std::optional<deliveryoptimizer::api::CoordinatedSolveResult> traffic_baseline;
  std::string traffic_payload;
  deliveryoptimizer::api::WeatherImpactEstimate weather_impact;
  int weather_service_adjustment_seconds{0};
};

[[nodiscard]] std::shared_ptr<deliveryoptimizer::api::SolveLifecycle>
LifecycleHandle(const std::shared_ptr<SyncSolveContext>& context) {
  // Aliasing shares the context control block; it does not allocate a second
  // lifecycle object or create a self-owning member cycle.
  return {context, &context->lifecycle};
}

[[nodiscard]] drogon::HttpResponsePtr BuildErrorResponse(const drogon::HttpStatusCode code,
                                                         const std::string_view error_message) {
  Json::Value body{Json::objectValue};
  body["error"] = std::string{error_message};
  auto response = drogon::HttpResponse::newHttpJsonResponse(std::move(body));
  response->setStatusCode(code);
  return response;
}

[[nodiscard]] drogon::HttpResponsePtr BuildValidationResponse(Json::Value issues) {
  Json::Value body{Json::objectValue};
  body["error"] = "Validation failed.";
  body["issues"] = std::move(issues);
  auto response = drogon::HttpResponse::newHttpJsonResponse(std::move(body));
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
BuildSolveExecutionResponse(deliveryoptimizer::api::SolveExecutionResult result) {
  if (result.response_body.has_value()) {
    auto response = drogon::HttpResponse::newHttpJsonResponse(std::move(*result.response_body));
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

void CompleteAndRespond(const std::shared_ptr<SyncSolveContext>& context,
                        CompletedResponse completed_response) {
  if (context->responded.exchange(true)) {
    return;
  }

  FinalizeSolveRequest(context->observability, LifecycleHandle(context), completed_response.outcome,
                       static_cast<std::uint16_t>(completed_response.response->getStatusCode()));

  // Keep the response in the aggregate so queueInLoop also captures one pointer.
  context->pending_response = std::move(completed_response.response);
  context->response_loop->queueInLoop([context] {
    auto callback = std::move(context->response_callback);
    callback(context->pending_response);
    context->pending_response.reset();
  });
}

void FinishWithTraffic(const std::shared_ptr<SyncSolveContext>& context,
                       deliveryoptimizer::api::CoordinatedSolveResult route_result) {
  using namespace deliveryoptimizer::api;

  if (!route_result.output.has_value() || !context->forecast.has_value()) {
    CompleteAndRespond(context, BuildSolveExecutionResponse(BuildSolveExecutionResult(
                                    *context->optimize_request, std::move(route_result),
                                    std::move(context->forecast))));
    return;
  }

  TrafficPostprocessPlan traffic_plan = PrepareTrafficPostprocessing(
      *context->traffic_options, *context->optimize_request, context->weather_impact,
      *route_result.output, *context->forecast);
  if (!traffic_plan.adjusted_vroom_input.has_value()) {
    CompleteAndRespond(context, BuildSolveExecutionResponse(BuildSolveExecutionResult(
                                    *context->optimize_request, std::move(route_result),
                                    std::move(context->forecast))));
    return;
  }

  context->traffic_baseline.emplace(std::move(route_result));
  context->traffic_payload = internal::RenderJson(*traffic_plan.adjusted_vroom_input);
  const SolveAdmissionStatus rerun_status = context->coordinator->Submit(
      SolveRequestSize{
          .jobs = context->optimize_request->jobs.size(),
          .vehicles = context->optimize_request->vehicles.size(),
      },
      [context] { return std::move(context->traffic_payload); },
      [context](CoordinatedSolveResult rerun_result) mutable {
        CoordinatedSolveResult final_result =
            PreferSuccessfulRerun(std::move(*context->traffic_baseline), std::move(rerun_result));
        context->traffic_baseline.reset();
        CompleteAndRespond(context, BuildSolveExecutionResponse(BuildSolveExecutionResult(
                                        *context->optimize_request, std::move(final_result),
                                        std::move(context->forecast))));
      });
  if (rerun_status != SolveAdmissionStatus::kAccepted) {
    CoordinatedSolveResult baseline = std::move(*context->traffic_baseline);
    context->traffic_baseline.reset();
    CompleteAndRespond(context, BuildSolveExecutionResponse(BuildSolveExecutionResult(
                                    *context->optimize_request, std::move(baseline),
                                    std::move(context->forecast))));
  }
}

} // namespace

namespace deliveryoptimizer::api {

void RegisterDeliveriesOptimizeEndpoint(drogon::HttpAppFramework& app,
                                        const SolveAdmissionConfig& admission_config,
                                        std::shared_ptr<ObservabilityRegistry> observability) {
  auto weather_options =
      std::make_shared<const WeatherForecastOptions>(ResolveWeatherForecastOptionsFromEnv());
  auto traffic_options =
      std::make_shared<const TrafficForecastOptions>(ResolveTrafficForecastOptionsFromEnv());
  auto runner = std::make_shared<ProcessVroomRunner>(ResolveVroomRuntimeConfigFromEnv());
  auto coordinator = std::make_shared<SolveCoordinator>(admission_config, runner,
                                                        SolveCoordinatorOptions{}, observability);

  app.registerHandler(
      "/api/v1/deliveries/optimize",
      [coordinator = std::move(coordinator), weather_options, traffic_options,
       observability = std::move(observability)](
          const drogon::HttpRequestPtr& request,
          std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
        auto context = std::make_shared<SyncSolveContext>();
        context->coordinator = coordinator;
        context->weather_options = weather_options;
        context->traffic_options = traffic_options;
        context->observability = observability;
        context->lifecycle = CreateSolveLifecycle(request);
        context->response_callback = std::move(callback);
        context->response_loop = trantor::EventLoop::getEventLoopOfCurrentThread();
        if (context->response_loop == nullptr) {
          context->response_loop = drogon::app().getLoop();
        }

        // All deferred lambdas capture only the shared request aggregate.
        const auto& parsed_json = request->getJsonObject();
        if (!parsed_json) {
          CompleteAndRespond(context,
                             CompletedResponse{
                                 .response = BuildErrorResponse(drogon::k400BadRequest,
                                                                "Request body must be valid JSON."),
                                 .outcome = SolveRequestOutcome::kInvalidJson,
                             });
          return;
        }

        const auto early_request_size = TryParseOptimizeRequestSize(*parsed_json);
        if (early_request_size.has_value()) {
          context->lifecycle.jobs = early_request_size->jobs;
          context->lifecycle.vehicles = early_request_size->vehicles;
          const SolveAdmissionStatus admission_status =
              coordinator->CheckAdmission(*early_request_size, LifecycleHandle(context));
          if (admission_status != SolveAdmissionStatus::kAccepted) {
            CompleteAndRespond(context, BuildAdmissionRejectionResponse(admission_status));
            return;
          }
        }

        Json::Value issues{Json::arrayValue};
        auto parsed_request = ParseAndValidateOptimizeRequest(*parsed_json, issues);
        if (!parsed_request.has_value()) {
          CompleteAndRespond(context, CompletedResponse{
                                          .response = BuildValidationResponse(std::move(issues)),
                                          .outcome = SolveRequestOutcome::kValidationFailed,
                                      });
          return;
        }

        context->optimize_request.emplace(std::move(parsed_request->input));
        context->lifecycle.jobs = context->optimize_request->jobs.size();
        context->lifecycle.vehicles = context->optimize_request->vehicles.size();

        const SolveRequestSize request_size{
            .jobs = context->optimize_request->jobs.size(),
            .vehicles = context->optimize_request->vehicles.size(),
        };
        const SolveAdmissionStatus admission_status = coordinator->Submit(
            request_size, [context] { return BuildVroomInputText(*context->optimize_request); },
            [context](CoordinatedSolveResult result) mutable {
              if (!result.output.has_value()) {
                CompleteAndRespond(
                    context, BuildSolveExecutionResponse(BuildSolveExecutionResult(
                                 *context->optimize_request, std::move(result), std::nullopt)));
                return;
              }

              // Copy only scalar policy. Empty provider strings make recalculation
              // short-circuit OpenWeather without allocating/copying URL or key text;
              // synchronous completion workers must not block on remote weather.
              const WeatherForecastOptions& configured_weather = *context->weather_options;
              WeatherForecastOptions sync_weather_options{
                  .enabled = configured_weather.enabled,
                  .weather_delay_seconds_per_stop =
                      configured_weather.weather_delay_seconds_per_stop,
                  .reoptimize_threshold_seconds = configured_weather.reoptimize_threshold_seconds,
                  .reoptimize_threshold_percent = configured_weather.reoptimize_threshold_percent,
                  .openweather_api_key = {},
                  .openweather_base_url = {},
              };
              const WeatherImpactEstimate impact = RecalculateWeatherImpact(
                  sync_weather_options, *context->optimize_request, *result.output);
              context->weather_impact = impact;
              context->forecast = BuildWeatherForecastAnnotation(sync_weather_options, impact);
              if (!impact.should_reoptimize) {
                FinishWithTraffic(context, std::move(result));
                return;
              }

              // Only the scalar adjustment is needed by the re-run factory, so it
              // lives on the shared context to keep every std::function capture at
              // the 16-byte small-buffer size.
              context->weather_service_adjustment_seconds =
                  impact.should_reoptimize ? impact.delay_seconds_per_stop : 0;
              const SolveAdmissionStatus rerun_status = context->coordinator->Submit(
                  SolveRequestSize{
                      .jobs = context->optimize_request->jobs.size(),
                      .vehicles = context->optimize_request->vehicles.size(),
                  },
                  [context] {
                    return BuildVroomInputText(*context->optimize_request,
                                               context->weather_service_adjustment_seconds);
                  },
                  [context](CoordinatedSolveResult rerun_result) mutable {
                    FinishWithTraffic(context, std::move(rerun_result));
                  });
              if (rerun_status != SolveAdmissionStatus::kAccepted) {
                CompleteAndRespond(context, BuildAdmissionRejectionResponse(rerun_status));
              }
            },
            LifecycleHandle(context));
        if (admission_status != SolveAdmissionStatus::kAccepted) {
          CompleteAndRespond(context, BuildAdmissionRejectionResponse(admission_status));
        }
      },
      {drogon::Post});
}

} // namespace deliveryoptimizer::api
