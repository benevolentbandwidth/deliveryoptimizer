#pragma once

#include "deliveryoptimizer/api/solve_admission.hpp"

namespace drogon {
class HttpAppFramework;
}

namespace deliveryoptimizer::api {

void RegisterDeliveriesOptimizeEndpoint(drogon::HttpAppFramework& app,
                                        const SolveAdmissionConfig& admission_config);

} // namespace deliveryoptimizer::api
