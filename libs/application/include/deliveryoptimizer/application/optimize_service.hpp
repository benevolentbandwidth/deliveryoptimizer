#pragma once

#include "deliveryoptimizer/domain/problem.hpp"

#include <string>

namespace deliveryoptimizer::application {

[[nodiscard]] std::string Optimize(const domain::DeliveryProblem& problem);

} // namespace deliveryoptimizer::application
