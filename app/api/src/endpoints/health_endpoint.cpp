#include "deliveryoptimizer/api/endpoints/health_endpoint.hpp"

#include "env_utils.hpp"

#include <chrono>
#include <drogon/drogon.h>
#include <filesystem>
#include <mutex>
#include <optional>
#include <string>
#include <string_view>
#include <unistd.h>
#include <utility>

namespace {

constexpr std::string_view kDefaultVroomBin = "/usr/local/bin/vroom";
constexpr std::string_view kDefaultOsrmUrl = "http://127.0.0.1:5001";
constexpr std::string_view kOsrmProbePath =
    "/nearest/v1/driving/-122.4194,37.7749?number=1&generate_hints=false";
constexpr double kOsrmProbeTimeoutSeconds = 4.0;
constexpr std::chrono::seconds kOsrmProbeCacheTtl{2};

struct OsrmProbeResult {
  bool ready;
  std::string detail;
};

[[nodiscard]] bool IsVroomBinaryReady() {
  const std::string vroom_bin =
      deliveryoptimizer::api::ResolveEnvOrDefault("VROOM_BIN", kDefaultVroomBin);
  std::error_code error;
  const std::filesystem::file_status status = std::filesystem::status(vroom_bin, error);
  if (error || !std::filesystem::is_regular_file(status)) {
    return false;
  }

  return ::access(vroom_bin.c_str(), X_OK) == 0;
}

[[nodiscard]] OsrmProbeResult EvaluateOsrmProbe(const drogon::ReqResult result,
                                                const drogon::HttpResponsePtr& response) {
  if (result != drogon::ReqResult::Ok) {
    return OsrmProbeResult{.ready = false, .detail = drogon::to_string(result)};
  }

  if (response == nullptr) {
    return OsrmProbeResult{.ready = false, .detail = "empty response"};
  }

  if (response->statusCode() != drogon::k200OK) {
    return OsrmProbeResult{.ready = false,
                           .detail =
                               "HTTP " + std::to_string(static_cast<int>(response->statusCode()))};
  }

  const auto& parsed_json = response->getJsonObject();
  if (!parsed_json) {
    const std::string& parse_error = response->getJsonError();
    if (parse_error.empty()) {
      return OsrmProbeResult{.ready = false, .detail = "invalid JSON"};
    }
    return OsrmProbeResult{.ready = false, .detail = parse_error};
  }

  const Json::Value& code = (*parsed_json)["code"];
  if (!code.isString()) {
    return OsrmProbeResult{.ready = false, .detail = "missing code field"};
  }

  const std::string code_text = code.asString();
  if (code_text != "Ok") {
    return OsrmProbeResult{.ready = false, .detail = code_text};
  }

  return OsrmProbeResult{.ready = true, .detail = code_text};
}

[[nodiscard]] drogon::HttpResponsePtr BuildHealthResponse(const bool vroom_ready,
                                                          const OsrmProbeResult& osrm_probe) {
  Json::Value body{Json::objectValue};
  const bool overall_ready = vroom_ready && osrm_probe.ready;
  body["status"] = overall_ready ? "ok" : "degraded";

  Json::Value checks{Json::objectValue};
  checks["vroom_binary"] = vroom_ready ? "ok" : "missing";
  checks["osrm"] = osrm_probe.ready ? "ok" : "down";
  checks["osrm_detail"] = osrm_probe.detail;
  body["checks"] = checks;

  auto response = drogon::HttpResponse::newHttpJsonResponse(body);
  response->setStatusCode(overall_ready ? drogon::k200OK : drogon::k503ServiceUnavailable);
  return response;
}

[[nodiscard]] drogon::HttpClientPtr GetOsrmHttpClient() {
  static drogon::HttpClientPtr client = drogon::HttpClient::newHttpClient(
      deliveryoptimizer::api::ResolveNormalizedUrlEnvOrDefault("OSRM_URL", kDefaultOsrmUrl));
  return client;
}

struct OsrmProbeCache {
  std::mutex mutex;
  std::optional<OsrmProbeResult> cached_result;
  std::chrono::steady_clock::time_point cached_at;
};

OsrmProbeCache& GetOsrmProbeCache() {
  static OsrmProbeCache cache;
  return cache;
}

std::optional<OsrmProbeResult> GetCachedOsrmProbe() {
  auto& cache = GetOsrmProbeCache();

  std::lock_guard<std::mutex> lock(cache.mutex);
  if (!cache.cached_result.has_value()) {
    return std::nullopt;
  }

  const auto now = std::chrono::steady_clock::now();
  if (now - cache.cached_at > kOsrmProbeCacheTtl) {
    return std::nullopt;
  }

  return cache.cached_result;
}

void CacheOsrmProbe(const OsrmProbeResult& result) {
  auto& cache = GetOsrmProbeCache();

  std::lock_guard<std::mutex> lock(cache.mutex);
  cache.cached_result = result;
  cache.cached_at = std::chrono::steady_clock::now();
}

} // namespace

namespace deliveryoptimizer::api {

void RegisterHealthEndpoint(drogon::HttpAppFramework& app) {
  app.registerHandler(
      "/health", [](const drogon::HttpRequestPtr& /*request*/,
                    std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
        const bool vroom_ready = IsVroomBinaryReady();
        if (const auto cached_probe = GetCachedOsrmProbe()) {
          std::move(callback)(BuildHealthResponse(vroom_ready, *cached_probe));
          return;
        }

        auto osrm_client = GetOsrmHttpClient();
        auto osrm_probe_request = drogon::HttpRequest::newHttpRequest();
        osrm_probe_request->setMethod(drogon::Get);
        osrm_probe_request->setPath(std::string{kOsrmProbePath});

        osrm_client->sendRequest(
            osrm_probe_request,
            [osrm_client = std::move(osrm_client), vroom_ready, callback = std::move(callback)](
                const drogon::ReqResult result, const drogon::HttpResponsePtr& response) mutable {
              (void)osrm_client;
              const OsrmProbeResult osrm_probe = EvaluateOsrmProbe(result, response);
              CacheOsrmProbe(osrm_probe);
              std::move(callback)(BuildHealthResponse(vroom_ready, osrm_probe));
            },
            kOsrmProbeTimeoutSeconds);
      });
}

} // namespace deliveryoptimizer::api
