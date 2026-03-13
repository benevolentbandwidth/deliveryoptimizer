#pragma once

#include <string>
#include <vector>

namespace deliveryoptimizer::adapters {

struct Coordinate {
  double lon{0.0};
  double lat{0.0};
};

[[nodiscard]] std::string BuildTablePath(const std::vector<Coordinate>& coordinates);
[[nodiscard]] std::string BuildRoutePath(const std::vector<Coordinate>& coordinates);

} // namespace deliveryoptimizer::adapters
