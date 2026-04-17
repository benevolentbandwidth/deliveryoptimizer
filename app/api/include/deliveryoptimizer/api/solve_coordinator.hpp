#pragma once

#include "deliveryoptimizer/api/observability.hpp"
#include "deliveryoptimizer/api/solve_admission.hpp"
#include "deliveryoptimizer/api/vroom_runner.hpp"

#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <deque>
#include <functional>
#include <json/json.h>
#include <memory>
#include <mutex>
#include <optional>
#include <thread>
#include <vector>

namespace deliveryoptimizer::api {

enum class CoordinatedSolveStatus : std::uint8_t {
  kSucceeded,
  kFailed,
  kTimedOut,
  kQueueWaitTimedOut,
};

struct CoordinatedSolveResult {
  CoordinatedSolveStatus status{CoordinatedSolveStatus::kFailed};
  std::optional<Json::Value> output;
};

struct SolveCoordinatorOptions {
  bool enable_queue_timer{true};
  std::optional<std::size_t> completion_worker_count;
  // Test hook: when false, the coordinator also suppresses the async log writer
  // if it has to create its own observability registry.
  bool start_workers{true};
};

class SolveCoordinator {
public:
  // Completion callbacks run on the coordinator's completion workers, not on solver workers.
  using CompletionCallback = std::function<void(CoordinatedSolveResult)>;
  using PayloadFactory = std::function<Json::Value()>;

  SolveCoordinator(SolveAdmissionConfig config, std::shared_ptr<const VroomRunner> runner,
                   SolveCoordinatorOptions options = {},
                   std::shared_ptr<ObservabilityRegistry> observability = nullptr);
  ~SolveCoordinator();

  SolveCoordinator(const SolveCoordinator&) = delete;
  SolveCoordinator& operator=(const SolveCoordinator&) = delete;
  SolveCoordinator(SolveCoordinator&&) = delete;
  SolveCoordinator& operator=(SolveCoordinator&&) = delete;

  [[nodiscard]] SolveAdmissionStatus
  CheckAdmission(const SolveRequestSize& request_size,
                 const std::shared_ptr<SolveLifecycle>& lifecycle = nullptr);

  [[nodiscard]] SolveAdmissionStatus Submit(const SolveRequestSize& request_size,
                                            PayloadFactory payload_factory,
                                            CompletionCallback callback,
                                            std::shared_ptr<SolveLifecycle> lifecycle = nullptr);

private:
  using CompletionTask = std::function<void()>;

  struct QueuedSolveRequest {
    PayloadFactory payload_factory;
    CompletionCallback callback;
    std::chrono::steady_clock::time_point deadline;
    std::shared_ptr<SolveLifecycle> lifecycle;
    bool started_immediately;
  };

  void EnqueueCompletion(CompletionTask task);
  void WorkerLoop();
  void QueueTimerLoop();
  void CompletionLoop();
  [[nodiscard]] SolveAdmissionStatus
  CheckAdmissionLocked(const SolveRequestSize& request_size,
                       const std::shared_ptr<SolveLifecycle>& lifecycle);

  SolveAdmissionConfig config_;
  SolveCoordinatorOptions options_;
  std::shared_ptr<const VroomRunner> runner_;
  std::shared_ptr<ObservabilityRegistry> observability_;
  std::mutex mutex_;
  std::condition_variable condition_;
  std::deque<QueuedSolveRequest> queue_;
  std::vector<std::jthread> workers_;
  std::jthread queue_timer_;
  std::mutex completion_mutex_;
  std::condition_variable completion_condition_;
  std::deque<CompletionTask> completion_queue_;
  std::vector<std::jthread> completion_workers_;
  std::size_t active_solves_{0U};
  std::uint64_t queue_version_{0U};
  bool shutting_down_{false};
  bool completion_shutting_down_{false};
};

} // namespace deliveryoptimizer::api
