#pragma once

#include "deliveryoptimizer/api/solve_admission.hpp"

#include <memory>

namespace drogon {
class HttpAppFramework;
}

namespace deliveryoptimizer::api {

class ObservabilityRegistry;

void RegisterDeliveriesOptimizeEndpoint(drogon::HttpAppFramework& app,
                                        const SolveAdmissionConfig& admission_config,
                                        std::shared_ptr<ObservabilityRegistry> observability);

} // namespace deliveryoptimizer::api
