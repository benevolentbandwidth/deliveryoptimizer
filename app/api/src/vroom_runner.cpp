#include "deliveryoptimizer/api/vroom_runner.hpp"

#include "endpoints/env_utils.hpp"

#include <algorithm>
#include <array>
#include <cerrno>
#include <chrono>
#include <cstdlib>
#include <fcntl.h>
#include <filesystem>
#include <fstream>
#include <limits>
#include <memory>
#include <poll.h>
#include <signal.h>
#include <spawn.h>
#include <string>
#include <string_view>
#include <sys/wait.h>
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
constexpr int kDefaultVroomTimeoutSecondsInt = 30;
constexpr std::string_view kVroomStdoutPath = "/dev/stdout";
constexpr std::size_t kMaxVroomOutputBytes = 8U * 1024U * 1024U;

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

[[nodiscard]] int ParseTimeoutSeconds(const std::string& value, const int default_timeout_seconds) {
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

[[nodiscard]] SpawnArguments
BuildSpawnArguments(const deliveryoptimizer::api::VroomRuntimeConfig& runtime_config,
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
      return errno == ECHILD;
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

} // namespace

namespace deliveryoptimizer::api {

ProcessVroomRunner::ProcessVroomRunner(VroomRuntimeConfig runtime_config)
    : runtime_config_(std::move(runtime_config)) {}

VroomRunResult ProcessVroomRunner::Run(const Json::Value& input_payload) const {
  const auto input_file = ScopedTempFile::Create("deliveryoptimizer-vroom-input-");
  if (!input_file.has_value()) {
    return VroomRunResult{.status = VroomRunStatus::kFailed, .output = std::nullopt};
  }
  if (!WritePayloadToFile(input_file->path(), input_payload)) {
    return VroomRunResult{.status = VroomRunStatus::kFailed, .output = std::nullopt};
  }

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

  SpawnArguments spawn_arguments = BuildSpawnArguments(runtime_config_, input_file->path());
  pid_t vroom_pid = -1;
  const int spawn_status =
      posix_spawn(&vroom_pid, runtime_config_.vroom_bin.c_str(), spawn_actions.Get(), nullptr,
                  spawn_arguments.argv.data(), environ);
  if (spawn_status != 0) {
    return VroomRunResult{.status = VroomRunStatus::kFailed, .output = std::nullopt};
  }
  output_write_end.Reset(-1);

  const ProcessMonitorResult monitor_result =
      MonitorProcessOutput(vroom_pid, runtime_config_.timeout_seconds, output_read_end);
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

VroomRuntimeConfig ResolveVroomRuntimeConfigFromEnv() {
  const std::string vroom_timeout =
      ResolveEnvOrDefault("VROOM_TIMEOUT_SECONDS", kDefaultVroomTimeoutSeconds);
  const int timeout_seconds = ParseTimeoutSeconds(vroom_timeout, kDefaultVroomTimeoutSecondsInt);

  return VroomRuntimeConfig{
      .vroom_bin = ResolveEnvOrDefault("VROOM_BIN", kDefaultVroomBin),
      .vroom_router = ResolveEnvOrDefault("VROOM_ROUTER", kDefaultVroomRouter),
      .vroom_host = ResolveEnvOrDefault("VROOM_HOST", kDefaultVroomHost),
      .vroom_port = ResolveEnvOrDefault("VROOM_PORT", kDefaultVroomPort),
      .timeout_seconds = timeout_seconds,
  };
}

} // namespace deliveryoptimizer::api
