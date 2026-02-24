#pragma once

#include "deliveryoptimizer/domain/problem.hpp"

#include <string>

namespace deliveryoptimizer::application {

class OptimizeService {
public:
  [[nodiscard]] std::string Optimize(const domain::DeliveryProblem& problem) const;
};

} // namespace deliveryoptimizer::application
