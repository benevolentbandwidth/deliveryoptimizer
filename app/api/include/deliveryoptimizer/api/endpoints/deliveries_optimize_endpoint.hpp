#pragma once

#include <memory>

#include "deliveryoptimizer/api/solve_admission.hpp"

namespace drogon {
class HttpAppFramework;
}

namespace deliveryoptimizer::api {

class ObservabilityRegistry;

void RegisterDeliveriesOptimizeEndpoint(drogon::HttpAppFramework& app,
                                        const SolveAdmissionConfig& admission_config,
                                        std::shared_ptr<ObservabilityRegistry> observability);

} // namespace deliveryoptimizer::api
