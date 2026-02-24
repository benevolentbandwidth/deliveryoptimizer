#include "deliveryoptimizer/adapters/routing_facade.hpp"

#include "deliveryoptimizer/application/optimize_service.hpp"
#include "deliveryoptimizer/domain/problem.hpp"

namespace deliveryoptimizer::adapters {

std::string RoutingFacade::Optimize(const std::size_t deliveries,
                                    const std::size_t vehicles) const {
  const domain::DeliveryProblem problem{deliveries, vehicles};
  const application::OptimizeService service;
  return service.Optimize(problem);
}

} // namespace deliveryoptimizer::adapters
