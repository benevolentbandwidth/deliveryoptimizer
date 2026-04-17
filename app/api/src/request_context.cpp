#include "deliveryoptimizer/api/observability.hpp"

#include <chrono>
#include <drogon/HttpRequest.h>
#include <drogon/utils/Utilities.h>
#include <string>
#include <utility>

namespace {

constexpr std::string_view kRequestContextAttributeKey = "deliveryoptimizer.request_context";

} // namespace

namespace deliveryoptimizer::api {

void EnsureRequestContext(const drogon::HttpRequestPtr& request) {
  if (request == nullptr) {
    return;
  }

  const auto& attributes = request->attributes();
  if (attributes->find(std::string{kRequestContextAttributeKey})) {
    return;
  }

  attributes->insert(std::string{kRequestContextAttributeKey},
                     RequestContext{
                         .request_id = drogon::utils::getUuid(),
                         .started_at = std::chrono::steady_clock::now(),
                     });
}

std::optional<RequestContext> GetRequestContext(const drogon::HttpRequestPtr& request) {
  if (request == nullptr) {
    return std::nullopt;
  }

  const auto& attributes = request->attributes();
  if (!attributes->find(std::string{kRequestContextAttributeKey})) {
    return std::nullopt;
  }

  return attributes->get<RequestContext>(std::string{kRequestContextAttributeKey});
}

SolveLifecycle CreateSolveLifecycle(const drogon::HttpRequestPtr& request) {
  EnsureRequestContext(request);
  const RequestContext context = GetRequestContext(request).value_or(RequestContext{
      .request_id = drogon::utils::getUuid(),
      .started_at = std::chrono::steady_clock::now(),
  });

  SolveLifecycle lifecycle{};
  lifecycle.request_id = context.request_id;
  lifecycle.method = request == nullptr ? "" : request->getMethodString();
  lifecycle.path = request == nullptr ? "" : request->path();
  lifecycle.request_started_at = context.started_at;
  return lifecycle;
}

} // namespace deliveryoptimizer::api
