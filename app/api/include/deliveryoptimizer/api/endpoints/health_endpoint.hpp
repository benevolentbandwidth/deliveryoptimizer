#pragma once

#include <functional>
#include <memory>

#include <json/json.h>

namespace drogon {
class HttpAppFramework;
}

namespace deliveryoptimizer::api {

class ObservabilityRegistry;

using HealthExtensionProvider = std::function<void(Json::Value& checks, bool& overall_ready)>;

void RegisterHealthEndpoint(drogon::HttpAppFramework& app,
                            std::shared_ptr<const ObservabilityRegistry> observability = nullptr,
                            HealthExtensionProvider extension = {});

} // namespace deliveryoptimizer::api
