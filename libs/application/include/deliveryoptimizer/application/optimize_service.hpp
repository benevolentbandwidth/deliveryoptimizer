#pragma once

#include "deliveryoptimizer/domain/problem.hpp"

#include <string>

namespace deliveryoptimizer::application {

class OptimizeService {
public:
  [[nodiscard]] static std::string Optimize(const domain::DeliveryProblem& problem);
};

} // namespace deliveryoptimizer::application
