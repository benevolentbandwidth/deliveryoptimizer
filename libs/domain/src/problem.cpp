#include "deliveryoptimizer/domain/problem.hpp"

#include <sstream>

namespace deliveryoptimizer::domain {

std::string DescribeProblem(const DeliveryProblem& problem) {
  std::ostringstream stream;
  stream << "deliveries=" << problem.deliveries << ", vehicles=" << problem.vehicles;
  return stream.str();
}

} // namespace deliveryoptimizer::domain
