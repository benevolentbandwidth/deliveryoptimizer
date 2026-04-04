#pragma once

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
};

class SolveCoordinator {
public:
  using CompletionCallback = std::function<void(CoordinatedSolveResult)>;
  using PayloadFactory = std::function<Json::Value()>;

  SolveCoordinator(SolveAdmissionConfig config, std::shared_ptr<const VroomRunner> runner,
                   SolveCoordinatorOptions options = {});
  ~SolveCoordinator();

  SolveCoordinator(const SolveCoordinator&) = delete;
  SolveCoordinator& operator=(const SolveCoordinator&) = delete;
  SolveCoordinator(SolveCoordinator&&) = delete;
  SolveCoordinator& operator=(SolveCoordinator&&) = delete;

  [[nodiscard]] SolveAdmissionStatus Submit(const SolveRequestSize& request_size,
                                            PayloadFactory payload_factory,
                                            CompletionCallback callback);

private:
  struct QueuedSolveRequest {
    std::uint64_t sequence_number;
    PayloadFactory payload_factory;
    CompletionCallback callback;
    std::chrono::steady_clock::time_point deadline;
  };

  void WorkerLoop();
  void QueueTimerLoop();

  SolveAdmissionConfig config_;
  SolveCoordinatorOptions options_;
  std::shared_ptr<const VroomRunner> runner_;
  std::mutex mutex_;
  std::condition_variable condition_;
  std::deque<QueuedSolveRequest> queue_;
  std::vector<std::jthread> workers_;
  std::jthread queue_timer_;
  std::size_t active_solves_{0U};
  std::uint64_t next_sequence_number_{1U};
  bool shutting_down_{false};
};

} // namespace deliveryoptimizer::api
