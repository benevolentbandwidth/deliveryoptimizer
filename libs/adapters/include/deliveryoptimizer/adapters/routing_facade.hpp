#pragma once

#include <cstddef>
#include <string>

namespace deliveryoptimizer::adapters {

[[nodiscard]] std::string Optimize(std::size_t deliveries, std::size_t vehicles);

} // namespace deliveryoptimizer::adapters
