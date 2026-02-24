#pragma once

#include <cstddef>
#include <string>

namespace deliveryoptimizer::adapters {

class RoutingFacade {
public:
  [[nodiscard]] std::string Optimize(std::size_t deliveries, std::size_t vehicles) const;
};

} // namespace deliveryoptimizer::adapters
