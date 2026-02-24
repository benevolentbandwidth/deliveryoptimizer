#include "deliveryoptimizer/application/optimize_service.hpp"

namespace deliveryoptimizer::application {

std::string OptimizeService::Optimize(const domain::DeliveryProblem& problem) const {
  if (problem.empty()) {
    return "no-plan: deliveries=0 or vehicles=0";
  }

  return "optimized-plan: " + domain::DescribeProblem(problem);
}

} // namespace deliveryoptimizer::application
