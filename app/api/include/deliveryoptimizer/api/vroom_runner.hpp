#pragma once

#include <cstdint>
#include <json/json.h>
#include <optional>
#include <string>

namespace deliveryoptimizer::api {

enum class VroomRunStatus : std::uint8_t {
  kSuccess,
  kFailed,
  kTimedOut,
};

struct VroomRunResult {
  VroomRunStatus status{VroomRunStatus::kFailed};
  std::optional<Json::Value> output;
};

struct VroomRuntimeConfig {
  std::string vroom_bin;
  std::string vroom_router;
  std::string vroom_host;
  std::string vroom_port;
  int timeout_seconds;
};

class VroomRunner {
public:
  virtual ~VroomRunner() = default;

  [[nodiscard]] virtual VroomRunResult Run(const Json::Value& input_payload) const = 0;
};

class ProcessVroomRunner final : public VroomRunner {
public:
  explicit ProcessVroomRunner(VroomRuntimeConfig runtime_config);

  [[nodiscard]] VroomRunResult Run(const Json::Value& input_payload) const override;

private:
  VroomRuntimeConfig runtime_config_;
};

[[nodiscard]] VroomRuntimeConfig ResolveVroomRuntimeConfigFromEnv();

} // namespace deliveryoptimizer::api
