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

[[nodiscard]] std::string BuildSolvePayload(std::size_t deliveries, std::size_t vehicles);
[[nodiscard]] std::optional<VroomSolveSummary> ParseSolveSummary(std::string_view response_json);
[[nodiscard]] std::string DescribeSolveSummary(const VroomSolveSummary& summary);

} // namespace deliveryoptimizer::adapters
