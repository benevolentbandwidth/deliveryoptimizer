#include "deliveryoptimizer/adapters/vroom_contract.hpp"

#include <json/json.h>
#include <memory>
#include <sstream>

namespace deliveryoptimizer::adapters {
namespace {

[[nodiscard]] Json::Value DepotLocation() {
  Json::Value location{Json::arrayValue};
  location.append(7.4236);
  location.append(43.7384);
  return location;
}

[[nodiscard]] Json::Value JobLocation(const std::size_t job_index) {
  const auto offset = static_cast<double>(job_index) * 0.001;

  Json::Value location{Json::arrayValue};
  location.append(7.4200 + offset);
  location.append(43.7300 + offset);
  return location;
}

[[nodiscard]] Json::Value UnitAmount() {
  Json::Value amount{Json::arrayValue};
  amount.append(1);
  return amount;
}

[[nodiscard]] Json::Value VehicleCapacity() {
  Json::Value capacity{Json::arrayValue};
  capacity.append(8);
  return capacity;
}

[[nodiscard]] std::optional<Json::Value> ParseJson(const std::string_view input) {
  Json::CharReaderBuilder builder;
  builder["collectComments"] = false;

  Json::Value root;
  JSONCPP_STRING errors;
  std::unique_ptr<Json::CharReader> reader{builder.newCharReader()};
  const auto* begin = input.data();
  const auto* end = begin + input.size();
  const bool parsed = reader->parse(begin, end, &root, &errors);
  if (!parsed) {
    return std::nullopt;
  }

  return root;
}

} // namespace

std::string BuildSolvePayload(const std::size_t deliveries, const std::size_t vehicles) {
  Json::Value payload{Json::objectValue};
  payload["jobs"] = Json::Value{Json::arrayValue};
  payload["vehicles"] = Json::Value{Json::arrayValue};

  for (std::size_t i = 0; i < deliveries; ++i) {
    Json::Value job{Json::objectValue};
    job["id"] = static_cast<Json::UInt64>(i + 1U);
    job["location"] = JobLocation(i);
    job["service"] = 120;
    job["amount"] = UnitAmount();
    payload["jobs"].append(job);
  }

  for (std::size_t i = 0; i < vehicles; ++i) {
    Json::Value vehicle{Json::objectValue};
    vehicle["id"] = static_cast<Json::UInt64>(i + 1U);
    vehicle["capacity"] = VehicleCapacity();
    vehicle["start"] = DepotLocation();
    vehicle["end"] = DepotLocation();
    payload["vehicles"].append(vehicle);
  }

  Json::StreamWriterBuilder writer_builder;
  writer_builder["indentation"] = "";
  return Json::writeString(writer_builder, payload);
}

std::optional<VroomSolveSummary> ParseSolveSummary(const std::string_view response_json) {
  const auto root = ParseJson(response_json);
  if (!root.has_value()) {
    return std::nullopt;
  }

  const Json::Value& summary = (*root)["summary"];
  if (!summary.isObject()) {
    return std::nullopt;
  }

  const Json::Value& routes = summary["routes"];
  const Json::Value& unassigned = summary["unassigned"];
  if (!routes.isUInt64() || !unassigned.isUInt64()) {
    return std::nullopt;
  }

  return VroomSolveSummary{static_cast<std::size_t>(routes.asUInt64()),
                           static_cast<std::size_t>(unassigned.asUInt64())};
}

std::string DescribeSolveSummary(const VroomSolveSummary& summary) {
  std::ostringstream stream;
  stream << "routes=" << summary.routes << ", unassigned=" << summary.unassigned;
  return stream.str();
}

} // namespace deliveryoptimizer::adapters
