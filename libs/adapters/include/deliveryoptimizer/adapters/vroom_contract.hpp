#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <string_view>

namespace deliveryoptimizer::adapters {

struct VroomSolveSummary {
  std::size_t routes{0};
  std::size_t unassigned{0};
};

class VroomContract {
public:
  [[nodiscard]] static std::string BuildSolvePayload(std::size_t deliveries, std::size_t vehicles);
  [[nodiscard]] static std::optional<VroomSolveSummary>
  ParseSolveSummary(std::string_view response_json);
  [[nodiscard]] static std::string DescribeSolveSummary(const VroomSolveSummary& summary);
};

} // namespace deliveryoptimizer::adapters
