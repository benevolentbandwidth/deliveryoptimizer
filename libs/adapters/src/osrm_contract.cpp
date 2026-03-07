#include "deliveryoptimizer/adapters/osrm_contract.hpp"

#include <iomanip>
#include <sstream>

namespace deliveryoptimizer::adapters {
namespace {

[[nodiscard]] std::string JoinCoordinates(const std::vector<Coordinate>& coordinates) {
  std::ostringstream stream;
  stream << std::fixed << std::setprecision(6);

  for (std::size_t i = 0; i < coordinates.size(); ++i) {
    if (i != 0U) {
      stream << ';';
    }

    stream << coordinates[i].lon << ',' << coordinates[i].lat;
  }

  return stream.str();
}

[[nodiscard]] bool HasMinimumPathCoordinates(const std::vector<Coordinate>& coordinates) {
  return coordinates.size() >= 2U;
}

} // namespace

std::string OsrmContract::BuildTablePath(const std::vector<Coordinate>& coordinates) {
  if (!HasMinimumPathCoordinates(coordinates)) {
    return {};
  }

  return "/table/v1/driving/" + JoinCoordinates(coordinates) + "?annotations=distance,duration";
}

std::string OsrmContract::BuildRoutePath(const std::vector<Coordinate>& coordinates) {
  if (!HasMinimumPathCoordinates(coordinates)) {
    return {};
  }

  return "/route/v1/driving/" + JoinCoordinates(coordinates) + "?overview=false&steps=false";
}

} // namespace deliveryoptimizer::adapters
