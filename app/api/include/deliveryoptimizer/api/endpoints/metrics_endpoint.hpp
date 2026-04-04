#pragma once

#include <memory>

namespace drogon {
class HttpAppFramework;
}

namespace deliveryoptimizer::api {

class ObservabilityRegistry;

void RegisterMetricsEndpoint(drogon::HttpAppFramework& app,
                             std::shared_ptr<ObservabilityRegistry> observability);

} // namespace deliveryoptimizer::api
