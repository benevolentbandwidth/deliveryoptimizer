#pragma once

#include <memory>

namespace drogon {
class HttpAppFramework;
}

namespace deliveryoptimizer::api {

class ObservabilityRegistry;
class OptimizationJobRuntime;
class OptimizationJobStore;

void RegisterOptimizationJobsEndpoints(drogon::HttpAppFramework& app,
                                       std::shared_ptr<OptimizationJobStore> store,
                                       std::shared_ptr<OptimizationJobRuntime> runtime,
                                       std::shared_ptr<ObservabilityRegistry> observability);

} // namespace deliveryoptimizer::api
