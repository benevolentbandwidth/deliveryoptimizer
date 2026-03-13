#pragma once

#include <cstddef>
#include <string>

namespace deliveryoptimizer::domain {

struct DeliveryProblem {
  std::size_t deliveries{0};
  std::size_t vehicles{0};

  [[nodiscard]] bool empty() const noexcept { return deliveries == 0U || vehicles == 0U; }
};

[[nodiscard]] std::string DescribeProblem(const DeliveryProblem& problem);

} // namespace deliveryoptimizer::domain
