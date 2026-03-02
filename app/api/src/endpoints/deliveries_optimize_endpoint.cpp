#include "deliveryoptimizer/api/endpoints/deliveries_optimize_endpoint.hpp"

#include "env_utils.hpp"
#include <algorithm>
#include <array>
#include <cerrno>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <drogon/drogon.h>
#include <fcntl.h>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <json/json.h>
#include <limits>
#include <map>
#include <memory>
#include <optional>
#include <poll.h>
#include <signal.h>
#include <spawn.h>
#include <string>
#include <string_view>
#include <sys/wait.h>
#include <system_error>
#include <unistd.h>
#include <utility>
#include <vector>

extern char** environ; // NOLINT(cppcoreguidelines-avoid-non-const-global-variables)

namespace {

constexpr std::string_view kDefaultVroomBin = "/usr/local/bin/vroom";
constexpr std::string_view kDefaultVroomRouter = "osrm";
constexpr std::string_view kDefaultVroomHost = "osrm";
constexpr std::string_view kDefaultVroomPort = "5001";
constexpr std::string_view kDefaultVroomTimeoutSeconds = "30";
constexpr std::string_view kVroomStdoutPath = "/dev/stdout";
constexpr int kDefaultJobServiceSeconds = 300;
constexpr double kMinLongitude = -180.0;
constexpr double kMaxLongitude = 180.0;
constexpr double kMinLatitude = -90.0;
constexpr double kMaxLatitude = 90.0;
constexpr Json::ArrayIndex kMaxOptimizeVehicles = 2000U;
constexpr Json::ArrayIndex kMaxOptimizeJobs = 10000U;
constexpr std::size_t kMaxVroomOutputBytes = 8U * 1024U * 1024U;

struct Coordinate {
  double lon;
  double lat;
};

struct TimeWindow {
  std::chrono::sys_seconds start;
  std::chrono::sys_seconds end;
};

struct VehicleInput {
  std::string external_id;
  int capacity;
  std::optional<Coordinate> start;
  std::optional<Coordinate> end;
  std::optional<TimeWindow> time_window;
};

struct JobInput {
  std::string external_id;
  double lon;
  double lat;
  int demand;
  int service;
  std::optional<std::vector<TimeWindow>> time_windows;
};

struct OptimizeRequestInput {
  double depot_lon;
  double depot_lat;
  std::vector<VehicleInput> vehicles;
  std::vector<JobInput> jobs;
};

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

struct SpawnArguments {
  std::vector<std::string> storage;
  std::vector<char*> argv;
};

enum class DrainReadStatus : std::uint8_t {
  kReadData,
  kWouldBlock,
  kClosed,
  kFailed,
};

enum class ProcessMonitorStatus : std::uint8_t {
  kCompleted,
  kFailed,
  kTimedOut,
};

struct ProcessMonitorResult {
  ProcessMonitorStatus status{ProcessMonitorStatus::kFailed};
  int command_status{0};
  std::string output_text;
};

class ScopedFileDescriptor {
public:
  explicit ScopedFileDescriptor(const int file_descriptor = -1)
      : file_descriptor_(file_descriptor) {}

  ScopedFileDescriptor(const ScopedFileDescriptor&) = delete;
  ScopedFileDescriptor& operator=(const ScopedFileDescriptor&) = delete;

  ScopedFileDescriptor(ScopedFileDescriptor&& other) noexcept
      : file_descriptor_(std::exchange(other.file_descriptor_, -1)) {}

  ScopedFileDescriptor& operator=(ScopedFileDescriptor&& other) noexcept {
    if (this == &other) {
      return *this;
    }

    Reset(other.Release());
    return *this;
  }

  ~ScopedFileDescriptor() { Reset(-1); }

  [[nodiscard]] int Get() const { return file_descriptor_; }

  [[nodiscard]] bool IsValid() const { return file_descriptor_ != -1; }

  [[nodiscard]] int Release() { return std::exchange(file_descriptor_, -1); }

  void Reset(const int file_descriptor) {
    if (file_descriptor_ != -1) {
      (void)close(file_descriptor_);
    }
    file_descriptor_ = file_descriptor;
  }

private:
  int file_descriptor_;
};

struct PipeEnds {
  ScopedFileDescriptor read_end;
  ScopedFileDescriptor write_end;
};

class ScopedSpawnFileActions {
public:
  ScopedSpawnFileActions() : initialized_(posix_spawn_file_actions_init(&actions_) == 0) {}

  ScopedSpawnFileActions(const ScopedSpawnFileActions&) = delete;
  ScopedSpawnFileActions& operator=(const ScopedSpawnFileActions&) = delete;
  ScopedSpawnFileActions(ScopedSpawnFileActions&&) = delete;
  ScopedSpawnFileActions& operator=(ScopedSpawnFileActions&&) = delete;

  ~ScopedSpawnFileActions() {
    if (initialized_) {
      (void)posix_spawn_file_actions_destroy(&actions_);
    }
  }

  [[nodiscard]] bool IsInitialized() const { return initialized_; }

  [[nodiscard]] posix_spawn_file_actions_t* Get() { return initialized_ ? &actions_ : nullptr; }

private:
  posix_spawn_file_actions_t actions_{};
  bool initialized_{false};
};

class ScopedTempFile {
public:
  static std::optional<ScopedTempFile> Create(const std::string_view prefix) {
    std::error_code error;
    const std::filesystem::path temp_dir = std::filesystem::temp_directory_path(error);
    if (error) {
      return std::nullopt;
    }

    std::string template_path = (temp_dir / (std::string{prefix} + "XXXXXX")).string();
    std::vector<char> writable_template(template_path.begin(), template_path.end());
    writable_template.push_back('\0');

    const int file_descriptor = mkstemp(writable_template.data());
    if (file_descriptor == -1) {
      return std::nullopt;
    }
    (void)close(file_descriptor);

    return ScopedTempFile(std::string{writable_template.data()});
  }

  explicit ScopedTempFile(std::string path) : path_(std::move(path)) {}

  ScopedTempFile(const ScopedTempFile&) = delete;
  ScopedTempFile& operator=(const ScopedTempFile&) = delete;

  ScopedTempFile(ScopedTempFile&& other) noexcept : path_(std::move(other.path_)) {
    other.path_.clear();
  }

  ScopedTempFile& operator=(ScopedTempFile&& other) noexcept {
    if (this == &other) {
      return *this;
    }

    RemoveFile();
    path_ = std::move(other.path_);
    other.path_.clear();
    return *this;
  }

  ~ScopedTempFile() { RemoveFile(); }

  [[nodiscard]] const std::string& path() const { return path_; }

private:
  void RemoveFile() {
    if (path_.empty()) {
      return;
    }

    std::error_code error;
    (void)std::filesystem::remove(path_, error);
  }

  std::string path_;
};

void AddValidationIssue(Json::Value& issues, const std::string_view field,
                        const std::string_view message) {
  Json::Value issue{Json::objectValue};
  issue["field"] = std::string{field};
  issue["message"] = std::string{message};
  issues.append(issue);
}

[[nodiscard]] std::string BuildMaxItemsMessage(const Json::ArrayIndex max_items) {
  return "must contain at most " + std::to_string(static_cast<unsigned long long>(max_items)) +
         " items.";
}

[[nodiscard]] std::optional<Coordinate> ParseCoordinate(const Json::Value& value) {
  if (!value.isArray() || value.size() != 2U || !value[0].isNumeric() || !value[1].isNumeric()) {
    return std::nullopt;
  }

  const double lon = value[0].asDouble();
  const double lat = value[1].asDouble();
  if (!std::isfinite(lon) || !std::isfinite(lat) || lon < kMinLongitude || lon > kMaxLongitude ||
      lat < kMinLatitude || lat > kMaxLatitude) {
    return std::nullopt;
  }

  return Coordinate{.lon = lon, .lat = lat};
}

[[nodiscard]] std::optional<int> ParseBoundedInt(const Json::Value& value, const int min_value) {
  if (value.isInt64()) {
    const Json::Int64 parsed = value.asInt64();
    if (parsed < static_cast<Json::Int64>(min_value) ||
        parsed > static_cast<Json::Int64>(std::numeric_limits<int>::max())) {
      return std::nullopt;
    }

    return static_cast<int>(parsed);
  }

  if (value.isUInt64()) {
    const Json::UInt64 parsed = value.asUInt64();
    if (parsed < static_cast<Json::UInt64>(min_value) ||
        parsed > static_cast<Json::UInt64>(std::numeric_limits<int>::max())) {
      return std::nullopt;
    }

    return static_cast<int>(parsed);
  }

  return std::nullopt;
}

[[nodiscard]] std::optional<std::chrono::sys_seconds>
ParseNonNegativeEpochSeconds(const Json::Value& value) {
  if (value.isInt64()) {
    const Json::Int64 parsed = value.asInt64();
    if (parsed < 0) {
      return std::nullopt;
    }

    return std::chrono::sys_seconds{std::chrono::seconds{static_cast<std::int64_t>(parsed)}};
  }

  if (value.isUInt64()) {
    const Json::UInt64 parsed = value.asUInt64();
    if (parsed > static_cast<Json::UInt64>(std::numeric_limits<std::int64_t>::max())) {
      return std::nullopt;
    }

    return std::chrono::sys_seconds{
        std::chrono::seconds{static_cast<std::int64_t>(parsed)},
    };
  }

  return std::nullopt;
}

[[nodiscard]] std::optional<TimeWindow> ParseTimeWindow(const Json::Value& value) {
  if (!value.isArray() || value.size() != 2U) {
    return std::nullopt;
  }

  const auto parsed_start = ParseNonNegativeEpochSeconds(value[0]);
  const auto parsed_end = ParseNonNegativeEpochSeconds(value[1]);
  if (!parsed_start.has_value() || !parsed_end.has_value() ||
      parsed_end.value() <= parsed_start.value()) {
    return std::nullopt;
  }

  return TimeWindow{
      .start = parsed_start.value(),
      .end = parsed_end.value(),
  };
}

[[nodiscard]] std::optional<std::vector<TimeWindow>> ParseTimeWindows(const Json::Value& value) {
  if (!value.isArray() || value.size() == 0U) {
    return std::nullopt;
  }

  std::vector<TimeWindow> windows;
  windows.reserve(value.size());
  for (Json::ArrayIndex index = 0U; index < value.size(); ++index) {
    const auto parsed_window = ParseTimeWindow(value[index]);
    if (!parsed_window.has_value()) {
      return std::nullopt;
    }
    windows.push_back(parsed_window.value());
  }

  return windows;
}

[[nodiscard]] std::optional<Json::UInt64> ParsePositiveId(const Json::Value& value) {
  if (value.isUInt64()) {
    const Json::UInt64 parsed = value.asUInt64();
    if (parsed > 0U) {
      return parsed;
    }
    return std::nullopt;
  }

  if (value.isInt64()) {
    const Json::Int64 parsed = value.asInt64();
    if (parsed > 0) {
      return static_cast<Json::UInt64>(parsed);
    }
  }

  return std::nullopt;
}

[[nodiscard]] std::optional<VehicleInput>
ParseVehicle(const Json::Value& vehicle, const std::string_view base_field, Json::Value& issues) {
  if (!vehicle.isObject()) {
    AddValidationIssue(issues, base_field, "must be an object.");
    return std::nullopt;
  }

  const Json::Value& vehicle_id = vehicle["id"];
  const Json::Value& capacity = vehicle["capacity"];
  const Json::Value& start = vehicle["start"];
  const Json::Value& end = vehicle["end"];
  const Json::Value& time_window = vehicle["time_window"];

  bool valid_vehicle = true;
  std::string external_id;
  std::optional<Coordinate> start_coordinate;
  std::optional<Coordinate> end_coordinate;
  std::optional<TimeWindow> vehicle_time_window;

  if (!vehicle_id.isString() || vehicle_id.asString().empty()) {
    AddValidationIssue(issues, std::string{base_field} + ".id", "must be a non-empty string.");
    valid_vehicle = false;
  } else {
    external_id = vehicle_id.asString();
  }

  const auto parsed_capacity = ParseBoundedInt(capacity, 1);
  if (!parsed_capacity.has_value()) {
    AddValidationIssue(issues, std::string{base_field} + ".capacity",
                       "must be a positive integer.");
    valid_vehicle = false;
  }

  if (vehicle.isMember("start")) {
    start_coordinate = ParseCoordinate(start);
    if (!start_coordinate.has_value()) {
      AddValidationIssue(issues, std::string{base_field} + ".start",
                         "must be an array [lon, lat] with numeric values.");
      valid_vehicle = false;
    }
  }

  if (vehicle.isMember("end")) {
    end_coordinate = ParseCoordinate(end);
    if (!end_coordinate.has_value()) {
      AddValidationIssue(issues, std::string{base_field} + ".end",
                         "must be an array [lon, lat] with numeric values.");
      valid_vehicle = false;
    }
  }

  if (vehicle.isMember("time_window")) {
    vehicle_time_window = ParseTimeWindow(time_window);
    if (!vehicle_time_window.has_value()) {
      AddValidationIssue(
          issues, std::string{base_field} + ".time_window",
          "must be an array [start, end] with non-negative integer values and end > start.");
      valid_vehicle = false;
    }
  }

  if (!valid_vehicle) {
    return std::nullopt;
  }

  return VehicleInput{.external_id = std::move(external_id),
                      .capacity = parsed_capacity.value(),
                      .start = start_coordinate,
                      .end = end_coordinate,
                      .time_window = vehicle_time_window};
}

[[nodiscard]] std::optional<JobInput>
ParseJob(const Json::Value& job, const std::string_view base_field, Json::Value& issues) {
  if (!job.isObject()) {
    AddValidationIssue(issues, base_field, "must be an object.");
    return std::nullopt;
  }

  const Json::Value& job_id = job["id"];
  const Json::Value& location = job["location"];
  const Json::Value& demand = job["demand"];
  const Json::Value& time_windows = job["time_windows"];

  bool valid_job = true;
  std::string external_id;
  if (!job_id.isString() || job_id.asString().empty()) {
    AddValidationIssue(issues, std::string{base_field} + ".id", "must be a non-empty string.");
    valid_job = false;
  } else {
    external_id = job_id.asString();
  }

  const auto parsed_location = ParseCoordinate(location);
  if (!parsed_location.has_value()) {
    AddValidationIssue(issues, std::string{base_field} + ".location",
                       "must be an array [lon, lat] with numeric values.");
    valid_job = false;
  }

  const auto parsed_demand = ParseBoundedInt(demand, 1);
  if (!parsed_demand.has_value()) {
    AddValidationIssue(issues, std::string{base_field} + ".demand", "must be a positive integer.");
    valid_job = false;
  }

  int parsed_service = kDefaultJobServiceSeconds;
  std::optional<std::vector<TimeWindow>> parsed_time_windows;
  if (job.isMember("service")) {
    const auto parsed_service_value = ParseBoundedInt(job["service"], 0);
    if (!parsed_service_value.has_value()) {
      AddValidationIssue(issues, std::string{base_field} + ".service",
                         "must be a non-negative integer.");
      valid_job = false;
    } else {
      parsed_service = parsed_service_value.value();
    }
  }

  if (job.isMember("time_windows")) {
    parsed_time_windows = ParseTimeWindows(time_windows);
    if (!parsed_time_windows.has_value()) {
      AddValidationIssue(issues, std::string{base_field} + ".time_windows",
                         "must be an array of [start, end] pairs with non-negative integer values "
                         "and end > start.");
      valid_job = false;
    }
  }

  if (!valid_job) {
    return std::nullopt;
  }

  return JobInput{.external_id = std::move(external_id),
                  .lon = parsed_location->lon,
                  .lat = parsed_location->lat,
                  .demand = parsed_demand.value(),
                  .service = parsed_service,
                  .time_windows = std::move(parsed_time_windows)};
}

void ParseDepot(const Json::Value& root, OptimizeRequestInput& parsed_input, Json::Value& issues) {
  const Json::Value& depot = root["depot"];
  if (!depot.isObject()) {
    AddValidationIssue(issues, "depot", "is required and must be an object.");
    return;
  }

  const auto depot_coordinate = ParseCoordinate(depot["location"]);
  if (!depot_coordinate.has_value()) {
    AddValidationIssue(issues, "depot.location",
                       "must be an array [lon, lat] with numeric values.");
    return;
  }

  parsed_input.depot_lon = depot_coordinate->lon;
  parsed_input.depot_lat = depot_coordinate->lat;
}

void ParseVehicles(const Json::Value& root, OptimizeRequestInput& parsed_input,
                   Json::Value& issues) {
  const Json::Value& vehicles = root["vehicles"];
  if (!vehicles.isArray()) {
    AddValidationIssue(issues, "vehicles", "is required and must be a non-empty array.");
    return;
  }

  if (vehicles.empty()) {
    AddValidationIssue(issues, "vehicles", "must not be empty.");
    return;
  }
  if (vehicles.size() > kMaxOptimizeVehicles) {
    AddValidationIssue(issues, "vehicles", BuildMaxItemsMessage(kMaxOptimizeVehicles));
    return;
  }

  for (Json::ArrayIndex index = 0U; index < vehicles.size(); ++index) {
    const std::string base_field = "vehicles[" + std::to_string(index) + "]";
    const auto parsed_vehicle = ParseVehicle(vehicles[index], base_field, issues);
    if (parsed_vehicle.has_value()) {
      parsed_input.vehicles.push_back(parsed_vehicle.value());
    }
  }
}

void ParseJobs(const Json::Value& root, OptimizeRequestInput& parsed_input, Json::Value& issues) {
  const Json::Value& jobs = root["jobs"];
  if (!jobs.isArray()) {
    AddValidationIssue(issues, "jobs", "is required and must be a non-empty array.");
    return;
  }

  if (jobs.empty()) {
    AddValidationIssue(issues, "jobs", "must not be empty.");
    return;
  }
  if (jobs.size() > kMaxOptimizeJobs) {
    AddValidationIssue(issues, "jobs", BuildMaxItemsMessage(kMaxOptimizeJobs));
    return;
  }

  for (Json::ArrayIndex index = 0U; index < jobs.size(); ++index) {
    const std::string base_field = "jobs[" + std::to_string(index) + "]";
    const auto parsed_job = ParseJob(jobs[index], base_field, issues);
    if (parsed_job.has_value()) {
      parsed_input.jobs.push_back(parsed_job.value());
    }
  }
}

[[nodiscard]] std::optional<OptimizeRequestInput> ParseAndValidateRequest(const Json::Value& root,
                                                                          Json::Value& issues) {
  issues = Json::Value{Json::arrayValue};
  if (!root.isObject()) {
    AddValidationIssue(issues, "body", "must be a JSON object.");
    return std::nullopt;
  }

  OptimizeRequestInput parsed_input{};
  ParseDepot(root, parsed_input, issues);
  ParseVehicles(root, parsed_input, issues);
  ParseJobs(root, parsed_input, issues);

  if (!issues.empty()) {
    return std::nullopt;
  }

  return parsed_input;
}

[[nodiscard]] Json::Value BuildLocation(const double lon, const double lat) {
  Json::Value location{Json::arrayValue};
  location.append(lon);
  location.append(lat);
  return location;
}

[[nodiscard]] Json::Value BuildUnitArray(const int value) {
  Json::Value values{Json::arrayValue};
  values.append(value);
  return values;
}

[[nodiscard]] Json::Value BuildTimeWindowArray(const TimeWindow& time_window) {
  Json::Value values{Json::arrayValue};
  values.append(static_cast<Json::Int64>(time_window.start.time_since_epoch().count()));
  values.append(static_cast<Json::Int64>(time_window.end.time_since_epoch().count()));
  return values;
}

[[nodiscard]] Json::Value BuildTimeWindowsArray(const std::vector<TimeWindow>& time_windows) {
  Json::Value values{Json::arrayValue};
  for (const auto& time_window : time_windows) {
    values.append(BuildTimeWindowArray(time_window));
  }
  return values;
}

[[nodiscard]] Json::Value BuildVroomInput(const OptimizeRequestInput& input) {
  Json::Value payload{Json::objectValue};
  payload["jobs"] = Json::Value{Json::arrayValue};
  payload["vehicles"] = Json::Value{Json::arrayValue};

  for (std::size_t index = 0U; index < input.jobs.size(); ++index) {
    const JobInput& job_input = input.jobs[index];
    Json::Value job{Json::objectValue};
    job["id"] = static_cast<Json::UInt64>(index + 1U);
    job["location"] = BuildLocation(job_input.lon, job_input.lat);
    job["amount"] = BuildUnitArray(job_input.demand);
    job["service"] = job_input.service;
    job["description"] = job_input.external_id;
    if (job_input.time_windows.has_value()) {
      job["time_windows"] = BuildTimeWindowsArray(job_input.time_windows.value());
    }
    payload["jobs"].append(job);
  }

  for (std::size_t index = 0U; index < input.vehicles.size(); ++index) {
    const VehicleInput& vehicle_input = input.vehicles[index];
    Json::Value vehicle{Json::objectValue};
    const Coordinate start = vehicle_input.start.value_or(Coordinate{
        .lon = input.depot_lon,
        .lat = input.depot_lat,
    });
    const Coordinate end = vehicle_input.end.value_or(Coordinate{
        .lon = input.depot_lon,
        .lat = input.depot_lat,
    });
    vehicle["id"] = static_cast<Json::UInt64>(index + 1U);
    vehicle["start"] = BuildLocation(start.lon, start.lat);
    vehicle["end"] = BuildLocation(end.lon, end.lat);
    vehicle["capacity"] = BuildUnitArray(vehicle_input.capacity);
    vehicle["description"] = vehicle_input.external_id;
    if (vehicle_input.time_window.has_value()) {
      vehicle["time_window"] = BuildTimeWindowArray(vehicle_input.time_window.value());
    }
    payload["vehicles"].append(vehicle);
  }

  return payload;
}

[[nodiscard]] std::map<Json::UInt64, std::string>
BuildVehicleExternalIdMap(const OptimizeRequestInput& input) {
  std::map<Json::UInt64, std::string> vehicle_map;
  for (std::size_t index = 0U; index < input.vehicles.size(); ++index) {
    vehicle_map[static_cast<Json::UInt64>(index + 1U)] = input.vehicles[index].external_id;
  }
  return vehicle_map;
}

[[nodiscard]] std::map<Json::UInt64, std::string>
BuildJobExternalIdMap(const OptimizeRequestInput& input) {
  std::map<Json::UInt64, std::string> job_map;
  for (std::size_t index = 0U; index < input.jobs.size(); ++index) {
    job_map[static_cast<Json::UInt64>(index + 1U)] = input.jobs[index].external_id;
  }
  return job_map;
}

void ApplyExternalIdsToRoutes(Json::Value& routes,
                              const std::map<Json::UInt64, std::string>& vehicle_map,
                              const std::map<Json::UInt64, std::string>& job_map) {
  if (!routes.isArray()) {
    return;
  }

  for (Json::ArrayIndex route_index = 0U; route_index < routes.size(); ++route_index) {
    Json::Value& route = routes[route_index];
    if (!route.isObject()) {
      continue;
    }

    const auto vehicle_id = ParsePositiveId(route["vehicle"]);
    if (vehicle_id.has_value()) {
      const auto vehicle_it = vehicle_map.find(*vehicle_id);
      if (vehicle_it != vehicle_map.end()) {
        route["vehicle_external_id"] = vehicle_it->second;
      }
    }

    Json::Value& steps = route["steps"];
    if (!steps.isArray()) {
      continue;
    }

    for (Json::ArrayIndex step_index = 0U; step_index < steps.size(); ++step_index) {
      Json::Value& step = steps[step_index];
      if (!step.isObject()) {
        continue;
      }
      const auto job_id = ParsePositiveId(step["job"]);
      if (!job_id.has_value()) {
        continue;
      }

      const auto job_it = job_map.find(*job_id);
      if (job_it != job_map.end()) {
        step["job_external_id"] = job_it->second;
      }
    }
  }
}

void ApplyExternalIdsToUnassigned(Json::Value& unassigned,
                                  const std::map<Json::UInt64, std::string>& job_map) {
  if (!unassigned.isArray()) {
    return;
  }

  for (Json::ArrayIndex index = 0U; index < unassigned.size(); ++index) {
    Json::Value& entry = unassigned[index];
    if (!entry.isObject()) {
      continue;
    }

    const auto job_id = ParsePositiveId(entry["id"]);
    if (!job_id.has_value()) {
      continue;
    }

    const auto job_it = job_map.find(*job_id);
    if (job_it != job_map.end()) {
      entry["job_external_id"] = job_it->second;
    }
  }
}

[[nodiscard]] int ParseTimeoutSeconds(const std::string& value,
                                      const int default_timeout_seconds) {
  errno = 0;
  char* end = nullptr;
  const long parsed = std::strtol(value.c_str(), &end, 10);
  if (errno != 0 || end == value.c_str() || *end != '\0' || parsed <= 0L ||
      parsed > static_cast<long>(std::numeric_limits<int>::max())) {
    return default_timeout_seconds;
  }

  return static_cast<int>(parsed);
}

[[nodiscard]] std::optional<Json::Value> ParseJson(const std::string_view input) {
  Json::CharReaderBuilder builder;
  builder["collectComments"] = false;

  Json::Value root;
  JSONCPP_STRING errors;
  std::unique_ptr<Json::CharReader> reader{builder.newCharReader()};
  const char* begin = input.data();
  const char* end = begin + input.size();
  const bool parsed = reader->parse(begin, end, &root, &errors);
  if (!parsed) {
    return std::nullopt;
  }

  return root;
}

[[nodiscard]] VroomRuntimeConfig ResolveVroomRuntimeConfig() {
  const std::string vroom_timeout = deliveryoptimizer::api::ResolveEnvOrDefault(
      "VROOM_TIMEOUT_SECONDS", kDefaultVroomTimeoutSeconds);
  const int timeout_seconds =
      ParseTimeoutSeconds(vroom_timeout, std::stoi(std::string{kDefaultVroomTimeoutSeconds}));

  return VroomRuntimeConfig{
      .vroom_bin =
          deliveryoptimizer::api::ResolveEnvOrDefault("VROOM_BIN", kDefaultVroomBin),
      .vroom_router =
          deliveryoptimizer::api::ResolveEnvOrDefault("VROOM_ROUTER", kDefaultVroomRouter),
      .vroom_host =
          deliveryoptimizer::api::ResolveEnvOrDefault("VROOM_HOST", kDefaultVroomHost),
      .vroom_port =
          deliveryoptimizer::api::ResolveEnvOrDefault("VROOM_PORT", kDefaultVroomPort),
      .timeout_seconds = timeout_seconds,
  };
}

[[nodiscard]] bool WritePayloadToFile(const std::string& path, const Json::Value& input_payload) {
  Json::StreamWriterBuilder writer_builder;
  writer_builder["indentation"] = "";
  const std::string payload_text = Json::writeString(writer_builder, input_payload);

  std::ofstream input_stream(path, std::ios::binary | std::ios::trunc);
  if (!input_stream.is_open()) {
    return false;
  }

  input_stream << payload_text;
  return input_stream.good();
}

[[nodiscard]] std::optional<PipeEnds> CreatePipeEnds() {
  std::array<int, 2> pipe_file_descriptors{-1, -1};
  if (pipe(pipe_file_descriptors.data()) != 0) {
    return std::nullopt;
  }

  return PipeEnds{
      .read_end = ScopedFileDescriptor{pipe_file_descriptors[0]},
      .write_end = ScopedFileDescriptor{pipe_file_descriptors[1]},
  };
}

[[nodiscard]] SpawnArguments BuildSpawnArguments(const VroomRuntimeConfig& runtime_config,
                                                 const std::string& input_file_path) {
  SpawnArguments spawn_arguments;
  spawn_arguments.storage = {
      runtime_config.vroom_bin,
      "--router",
      runtime_config.vroom_router,
      "--host",
      runtime_config.vroom_host,
      "--port",
      runtime_config.vroom_port,
      "--limit",
      std::to_string(runtime_config.timeout_seconds),
      "--input",
      input_file_path,
      "--output",
      std::string{kVroomStdoutPath},
  };

  spawn_arguments.argv.reserve(spawn_arguments.storage.size() + 1U);
  for (std::string& argument : spawn_arguments.storage) {
    spawn_arguments.argv.push_back(argument.data());
  }
  spawn_arguments.argv.push_back(nullptr);
  return spawn_arguments;
}

[[nodiscard]] bool TryWaitForProcessExit(const pid_t process_id, int& command_status,
                                         bool& process_exited) {
  if (process_exited) {
    return true;
  }

  const pid_t wait_result = waitpid(process_id, &command_status, WNOHANG);
  if (wait_result == process_id || wait_result == 0) {
    process_exited = (wait_result == process_id);
    return true;
  }

  return wait_result == -1 && errno == EINTR;
}

[[nodiscard]] DrainReadStatus ReadOutputChunk(const ScopedFileDescriptor& output_read_end,
                                              std::string& output_text) {
  std::array<char, 8192> buffer{};
  const ssize_t read_bytes = read(output_read_end.Get(), buffer.data(), buffer.size());
  if (read_bytes > 0) {
    output_text.append(buffer.data(), static_cast<std::size_t>(read_bytes));
    if (output_text.size() > kMaxVroomOutputBytes) {
      return DrainReadStatus::kFailed;
    }
    return DrainReadStatus::kReadData;
  }
  if (read_bytes == 0) {
    return DrainReadStatus::kClosed;
  }
  if (errno == EINTR || errno == EAGAIN || errno == EWOULDBLOCK) {
    return DrainReadStatus::kWouldBlock;
  }
  return DrainReadStatus::kFailed;
}

[[nodiscard]] bool DrainAvailableOutput(const ScopedFileDescriptor& output_read_end,
                                        std::string& output_text, bool& output_closed) {
  while (!output_closed) {
    const DrainReadStatus read_status = ReadOutputChunk(output_read_end, output_text);
    if (read_status == DrainReadStatus::kReadData) {
      continue;
    }
    if (read_status == DrainReadStatus::kClosed) {
      output_closed = true;
      break;
    }
    if (read_status == DrainReadStatus::kWouldBlock) {
      break;
    }
    return false;
  }
  return true;
}

[[nodiscard]] bool KillAndReapProcess(const pid_t process_id, int& command_status) {
  if (kill(process_id, SIGKILL) == -1 && errno != ESRCH) {
    return false;
  }
  while (waitpid(process_id, &command_status, 0) == -1) {
    if (errno != EINTR) {
      if (errno == ECHILD) {
        return true;
      }
      return false;
    }
  }
  return true;
}

[[nodiscard]] int ComputePollTimeoutMs(const bool process_exited,
                                       const std::chrono::steady_clock::time_point now,
                                       const std::chrono::steady_clock::time_point deadline) {
  if (process_exited) {
    return 0;
  }

  const auto remaining = std::chrono::duration_cast<std::chrono::milliseconds>(deadline - now);
  const std::int64_t clamped_ms =
      std::clamp<std::int64_t>(remaining.count(), 1, std::numeric_limits<int>::max());
  return static_cast<int>(clamped_ms);
}

[[nodiscard]] int PollOutputDescriptor(const ScopedFileDescriptor& output_read_end,
                                       const int poll_timeout_ms) {
  pollfd output_poll{};
  output_poll.fd = output_read_end.Get();
  output_poll.events = static_cast<short>(POLLIN | POLLHUP);
  return poll(&output_poll, 1, poll_timeout_ms);
}

[[nodiscard]] bool SetNonBlocking(const int file_descriptor) {
  // POSIX fcntl is varargs by design.
  // NOLINTNEXTLINE(cppcoreguidelines-pro-type-vararg)
  const int current_flags = fcntl(file_descriptor, F_GETFL, 0);
  if (current_flags == -1) {
    return false;
  }

  // POSIX fcntl is varargs by design.
  // NOLINTNEXTLINE(cppcoreguidelines-pro-type-vararg)
  return fcntl(file_descriptor, F_SETFL, current_flags | O_NONBLOCK) != -1;
}

[[nodiscard]] ProcessMonitorResult
MonitorProcessOutput(const pid_t process_id, const int timeout_seconds,
                     const ScopedFileDescriptor& output_read_end) {
  ProcessMonitorResult monitor_result{};
  bool process_exited = false;
  bool output_closed = false;
  const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(timeout_seconds);

  while (true) {
    if (!TryWaitForProcessExit(process_id, monitor_result.command_status, process_exited)) {
      return monitor_result;
    }

    if (!DrainAvailableOutput(output_read_end, monitor_result.output_text, output_closed)) {
      return monitor_result;
    }

    if (process_exited && output_closed) {
      monitor_result.status = ProcessMonitorStatus::kCompleted;
      return monitor_result;
    }

    const auto now = std::chrono::steady_clock::now();
    if (!process_exited && now >= deadline) {
      monitor_result.status = KillAndReapProcess(process_id, monitor_result.command_status)
                                  ? ProcessMonitorStatus::kTimedOut
                                  : ProcessMonitorStatus::kFailed;
      return monitor_result;
    }

    const int poll_timeout_ms = ComputePollTimeoutMs(process_exited, now, deadline);
    const int poll_status = PollOutputDescriptor(output_read_end, poll_timeout_ms);
    if (poll_status == -1) {
      if (errno == EINTR) {
        continue;
      }
      return monitor_result;
    }

    if (poll_status == 0 && !process_exited) {
      monitor_result.status = KillAndReapProcess(process_id, monitor_result.command_status)
                                  ? ProcessMonitorStatus::kTimedOut
                                  : ProcessMonitorStatus::kFailed;
      return monitor_result;
    }
  }
}

[[nodiscard]] VroomRunResult RunVroom(const Json::Value& input_payload) {
  const auto input_file = ScopedTempFile::Create("deliveryoptimizer-vroom-input-");
  if (!input_file.has_value()) {
    return VroomRunResult{.status = VroomRunStatus::kFailed, .output = std::nullopt};
  }
  if (!WritePayloadToFile(input_file->path(), input_payload)) {
    return VroomRunResult{.status = VroomRunStatus::kFailed, .output = std::nullopt};
  }

  const VroomRuntimeConfig runtime_config = ResolveVroomRuntimeConfig();
  auto pipe_ends = CreatePipeEnds();
  if (!pipe_ends.has_value()) {
    return VroomRunResult{.status = VroomRunStatus::kFailed, .output = std::nullopt};
  }

  ScopedFileDescriptor output_read_end = std::move(pipe_ends->read_end);
  ScopedFileDescriptor output_write_end = std::move(pipe_ends->write_end);
  if (!SetNonBlocking(output_read_end.Get())) {
    return VroomRunResult{.status = VroomRunStatus::kFailed, .output = std::nullopt};
  }

  ScopedSpawnFileActions spawn_actions;
  if (!spawn_actions.IsInitialized()) {
    return VroomRunResult{.status = VroomRunStatus::kFailed, .output = std::nullopt};
  }
  if (posix_spawn_file_actions_adddup2(spawn_actions.Get(), output_write_end.Get(),
                                       STDOUT_FILENO) != 0 ||
      posix_spawn_file_actions_addclose(spawn_actions.Get(), output_read_end.Get()) != 0 ||
      posix_spawn_file_actions_addclose(spawn_actions.Get(), output_write_end.Get()) != 0) {
    return VroomRunResult{.status = VroomRunStatus::kFailed, .output = std::nullopt};
  }

  SpawnArguments spawn_arguments = BuildSpawnArguments(runtime_config, input_file->path());
  pid_t vroom_pid = -1;
  const int spawn_status =
      posix_spawn(&vroom_pid, runtime_config.vroom_bin.c_str(), spawn_actions.Get(), nullptr,
                  spawn_arguments.argv.data(), environ);
  if (spawn_status != 0) {
    return VroomRunResult{.status = VroomRunStatus::kFailed, .output = std::nullopt};
  }
  output_write_end.Reset(-1);

  const ProcessMonitorResult monitor_result =
      MonitorProcessOutput(vroom_pid, runtime_config.timeout_seconds, output_read_end);
  if (monitor_result.status == ProcessMonitorStatus::kTimedOut) {
    return VroomRunResult{.status = VroomRunStatus::kTimedOut, .output = std::nullopt};
  }
  if (monitor_result.status != ProcessMonitorStatus::kCompleted) {
    int reap_status = monitor_result.command_status;
    (void)KillAndReapProcess(vroom_pid, reap_status);
    return VroomRunResult{.status = VroomRunStatus::kFailed, .output = std::nullopt};
  }

  if (!WIFEXITED(monitor_result.command_status) ||
      WEXITSTATUS(monitor_result.command_status) != 0) {
    return VroomRunResult{.status = VroomRunStatus::kFailed, .output = std::nullopt};
  }
  if (monitor_result.output_text.empty()) {
    return VroomRunResult{.status = VroomRunStatus::kFailed, .output = std::nullopt};
  }

  auto parsed = ParseJson(monitor_result.output_text);
  if (!parsed.has_value()) {
    return VroomRunResult{.status = VroomRunStatus::kFailed, .output = std::nullopt};
  }

  return VroomRunResult{
      .status = VroomRunStatus::kSuccess,
      .output = std::move(parsed),
  };
}

[[nodiscard]] drogon::HttpResponsePtr BuildErrorResponse(const drogon::HttpStatusCode code,
                                                         const std::string_view error_message) {
  Json::Value body{Json::objectValue};
  body["error"] = std::string{error_message};
  auto response = drogon::HttpResponse::newHttpJsonResponse(body);
  response->setStatusCode(code);
  return response;
}

} // namespace

namespace deliveryoptimizer::api {

void RegisterDeliveriesOptimizeEndpoint(drogon::HttpAppFramework& app) {
  app.registerHandler(
      "/api/v1/deliveries/optimize",
      [](const drogon::HttpRequestPtr& request,
         std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
        const auto& parsed_json = request->getJsonObject();
        if (!parsed_json) {
          std::move(callback)(
              BuildErrorResponse(drogon::k400BadRequest, "Request body must be valid JSON."));
          return;
        }

        Json::Value issues{Json::arrayValue};
        const auto parsed_input = ParseAndValidateRequest(*parsed_json, issues);
        if (!parsed_input.has_value()) {
          Json::Value body{Json::objectValue};
          body["error"] = "Validation failed.";
          body["issues"] = issues;
          auto response = drogon::HttpResponse::newHttpJsonResponse(body);
          response->setStatusCode(drogon::k400BadRequest);
          std::move(callback)(response);
          return;
        }

        const Json::Value vroom_input = BuildVroomInput(parsed_input.value());
        const VroomRunResult vroom_result = RunVroom(vroom_input);
        if (vroom_result.status == VroomRunStatus::kTimedOut) {
          std::move(callback)(
              BuildErrorResponse(drogon::k504GatewayTimeout, "Routing optimization timed out."));
          return;
        }
        if (!vroom_result.output.has_value()) {
          std::move(callback)(
              BuildErrorResponse(drogon::k502BadGateway, "Routing optimization failed."));
          return;
        }

        Json::Value body{Json::objectValue};
        body["status"] = "ok";
        const Json::Value& summary = (*vroom_result.output)["summary"];
        body["summary"] = summary.isObject() ? summary : Json::Value{Json::objectValue};

        Json::Value routes = (*vroom_result.output)["routes"];
        if (!routes.isArray()) {
          routes = Json::Value{Json::arrayValue};
        }
        Json::Value unassigned = (*vroom_result.output)["unassigned"];
        if (!unassigned.isArray()) {
          unassigned = Json::Value{Json::arrayValue};
        }
        const auto vehicle_map = BuildVehicleExternalIdMap(parsed_input.value());
        const auto job_map = BuildJobExternalIdMap(parsed_input.value());
        ApplyExternalIdsToRoutes(routes, vehicle_map, job_map);
        ApplyExternalIdsToUnassigned(unassigned, job_map);
        body["routes"] = std::move(routes);
        body["unassigned"] = std::move(unassigned);

        std::move(callback)(drogon::HttpResponse::newHttpJsonResponse(body));
      },
      {drogon::Post});
}

} // namespace deliveryoptimizer::api
