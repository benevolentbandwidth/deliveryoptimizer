#include "deliveryoptimizer/adapters/routing_facade.hpp"

#include "deliveryoptimizer/application/optimize_service.hpp"
#include "deliveryoptimizer/domain/problem.hpp"

namespace deliveryoptimizer::adapters {

std::string Optimize(const std::size_t deliveries, const std::size_t vehicles) {
  const domain::DeliveryProblem problem{deliveries, vehicles};
  return application::Optimize(problem);
}

} // namespace deliveryoptimizer::adapters
