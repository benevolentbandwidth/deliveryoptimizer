#pragma once

#include "deliveryoptimizer/api/observability.hpp"
#include "deliveryoptimizer/api/optimization_job_store.hpp"
#include "deliveryoptimizer/api/vroom_runner.hpp"

#include <chrono>
#include <deque>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <thread>
#include <vector>

namespace deliveryoptimizer::api {

struct OptimizationJobRuntimeOptions {
  std::size_t worker_count{2U};
  std::chrono::milliseconds poll_interval{std::chrono::milliseconds{250}};
  std::chrono::milliseconds heartbeat_interval{std::chrono::milliseconds{1000}};
  std::chrono::milliseconds sweep_interval{std::chrono::milliseconds{1000}};
  std::chrono::milliseconds worker_health_timeout{std::chrono::milliseconds{5000}};
  bool start_workers{true};
};

class OptimizationJobRuntime {
public:
  OptimizationJobRuntime(std::shared_ptr<OptimizationJobStore> store,
                         std::shared_ptr<const VroomRunner> runner,
                         std::shared_ptr<ObservabilityRegistry> observability,
                         OptimizationJobRuntimeOptions options = {});
  ~OptimizationJobRuntime();

  OptimizationJobRuntime(const OptimizationJobRuntime&) = delete;
  OptimizationJobRuntime& operator=(const OptimizationJobRuntime&) = delete;
  OptimizationJobRuntime(OptimizationJobRuntime&&) = delete;
  OptimizationJobRuntime& operator=(OptimizationJobRuntime&&) = delete;

  [[nodiscard]] bool IsConfigured() const;
  [[nodiscard]] bool IsSchemaReady() const;
  [[nodiscard]] std::string SchemaStatusDetail() const;
  [[nodiscard]] std::size_t ExpectedWorkerCount() const;
  [[nodiscard]] std::size_t HealthyWorkerCount() const;
  [[nodiscard]] OptimizationJobStoreStats CurrentStats() const;

private:
  struct WorkerState {
    std::string worker_id;
    mutable std::mutex mutex;
    std::optional<std::string> current_job_id;
    std::optional<std::chrono::steady_clock::time_point> last_heartbeat_at;
  };

  void SetCurrentJobId(WorkerState& worker_state, std::optional<std::string> current_job_id);
  [[nodiscard]] std::optional<std::string> CurrentJobId(const WorkerState& worker_state) const;
  void MarkWorkerHeartbeat(WorkerState& worker_state);
  [[nodiscard]] std::size_t CountHealthyWorkers() const;
  void WorkerLoop(std::stop_token stop_token, std::size_t worker_index);
  void HeartbeatLoop(std::stop_token stop_token);
  void SweepLoop(std::stop_token stop_token);
  void RefreshObservability();

  std::shared_ptr<OptimizationJobStore> store_;
  std::shared_ptr<const VroomRunner> runner_;
  std::shared_ptr<ObservabilityRegistry> observability_;
  OptimizationJobRuntimeOptions options_;
  std::deque<WorkerState> worker_states_;
  std::vector<std::jthread> workers_;
  std::jthread heartbeat_thread_;
  std::jthread sweep_thread_;
  mutable std::mutex stats_mutex_;
  OptimizationJobStoreStats last_stats_{};
  std::size_t healthy_workers_{0U};
  bool schema_ready_{false};
  std::string schema_status_detail_{"missing database connection string"};
};

} // namespace deliveryoptimizer::api
