#include "deliveryoptimizer/application/optimize_service.hpp"

namespace deliveryoptimizer::application {

std::string Optimize(const domain::DeliveryProblem& problem) {
  if (problem.empty()) {
    return "no-plan: deliveries=0 or vehicles=0";
  }

  return "optimized-plan: " + domain::DescribeProblem(problem);
}

} // namespace deliveryoptimizer::application
