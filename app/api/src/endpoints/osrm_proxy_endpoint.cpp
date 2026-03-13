#include "deliveryoptimizer/api/endpoints/osrm_proxy_endpoint.hpp"

#include <cstdlib>
#include <drogon/drogon.h>
#include <string>
#include <string_view>
#include <utility>

namespace {

constexpr std::string_view kDefaultOsrmBaseUrl = "http://127.0.0.1:5001";

[[nodiscard]] std::string ResolveOsrmBaseUrl() {
  const char* raw_osrm_url = std::getenv("OSRM_URL");
  if (raw_osrm_url == nullptr || *raw_osrm_url == '\0') {
    return std::string{kDefaultOsrmBaseUrl};
  }

  std::string normalized_url{raw_osrm_url};
  if (!normalized_url.empty() && normalized_url.back() == '/') {
    normalized_url.pop_back();
  }

  if (normalized_url.empty()) {
    return std::string{kDefaultOsrmBaseUrl};
  }

  return normalized_url;
}

[[nodiscard]] std::string_view ResolveServiceName(const std::string_view path_suffix) {
  const auto separator = path_suffix.find('/');
  if (separator == std::string_view::npos) {
    return path_suffix;
  }

  return path_suffix.substr(0, separator);
}

[[nodiscard]] bool IsAllowedService(const std::string_view service_name) {
  return service_name == "nearest" || service_name == "route" || service_name == "table" ||
         service_name == "match" || service_name == "trip";
}

} // namespace

namespace deliveryoptimizer::api {

void RegisterOsrmProxyEndpoint(drogon::HttpAppFramework& app) {
  const auto osrm_base_url = ResolveOsrmBaseUrl();
  auto osrm_client = drogon::HttpClient::newHttpClient(osrm_base_url);

  app.registerHandlerViaRegex(
      "^/api/v1/osrm/(.+)$",
      [osrm_client = std::move(osrm_client)](const drogon::HttpRequestPtr& request,
                                             std::function<void(const drogon::HttpResponsePtr&)>&& callback,
                                             const std::string& path_suffix) mutable {
        const auto service_name = ResolveServiceName(path_suffix);
        if (!IsAllowedService(service_name)) {
          Json::Value body;
          body["error"] = "OSRM service not allowed.";
          auto response = drogon::HttpResponse::newHttpJsonResponse(body);
          response->setStatusCode(drogon::k403Forbidden);
          std::move(callback)(response);
          return;
        }

        auto upstream_request = drogon::HttpRequest::newHttpRequest();
        upstream_request->setMethod(drogon::Get);
        upstream_request->setPassThrough(true);

        const auto& query = request->query();
        const std::string path =
            query.empty() ? "/" + path_suffix : "/" + path_suffix + "?" + query;
        upstream_request->setPath(path);

        osrm_client->sendRequest(
            upstream_request,
            [callback = std::move(callback)](const drogon::ReqResult result,
                                             const drogon::HttpResponsePtr& response) mutable {
              if (result == drogon::ReqResult::Ok && response != nullptr) {
                std::move(callback)(response);
                return;
              }

              Json::Value body;
              body["error"] = "OSRM upstream request failed.";
              auto upstream_error = drogon::HttpResponse::newHttpJsonResponse(body);
              upstream_error->setStatusCode(drogon::k502BadGateway);
              std::move(callback)(upstream_error);
            });
      },
      {drogon::Get});
}

} // namespace deliveryoptimizer::api
