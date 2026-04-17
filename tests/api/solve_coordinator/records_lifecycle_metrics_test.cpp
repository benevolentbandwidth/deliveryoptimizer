#include "deliveryoptimizer/api/observability.hpp"
#include "deliveryoptimizer/api/solve_coordinator.hpp"
#include "deliveryoptimizer/api/vroom_runner.hpp"

#include <chrono>
#include <condition_variable>
#include <future>
#include <gtest/gtest.h>
#include <json/json.h>
#include <memory>
#include <mutex>
#include <string>
#include <thread>

namespace {

using SteadyClock = std::chrono::steady_clock;

class BlockingRunner final : public deliveryoptimizer::api::VroomRunner {
public:
  deliveryoptimizer::api::VroomRunResult Run(const Json::Value& input) const override {
    (void)input;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      started_ = true;
    }
    condition_.notify_all();

    std::unique_lock<std::mutex> lock(mutex_);
    condition_.wait(lock, [this] { return released_; });

    return deliveryoptimizer::api::VroomRunResult{
        .status = deliveryoptimizer::api::VroomRunStatus::kSuccess,
        .output = Json::Value{Json::objectValue},
    };
  }

  void WaitUntilStarted() const {
    std::unique_lock<std::mutex> lock(mutex_);
    condition_.wait(lock, [this] { return started_; });
  }

  void Release() const {
    {
      std::lock_guard<std::mutex> lock(mutex_);
      released_ = true;
    }
    condition_.notify_all();
  }

private:
  mutable std::mutex mutex_;
  mutable std::condition_variable condition_;
  mutable bool started_{false};
  mutable bool released_{false};
};

class ImmediateRunner final : public deliveryoptimizer::api::VroomRunner {
public:
  deliveryoptimizer::api::VroomRunResult Run(const Json::Value& input) const override {
    (void)input;
    return deliveryoptimizer::api::VroomRunResult{
        .status = deliveryoptimizer::api::VroomRunStatus::kSuccess,
        .output = Json::Value{Json::objectValue},
    };
  }
};

[[nodiscard]] deliveryoptimizer::api::SolveAdmissionConfig BuildConfig() {
  return deliveryoptimizer::api::SolveAdmissionConfig{
      .max_concurrency = 1U,
      .max_queue_size = 1U,
      .max_queue_wait = std::chrono::milliseconds{1000},
      .max_sync_jobs = 5U,
      .max_sync_vehicles = 2U,
  };
}

[[nodiscard]] std::shared_ptr<deliveryoptimizer::api::SolveLifecycle>
BuildLifecycle(const std::string& request_id) {
  auto lifecycle = std::make_shared<deliveryoptimizer::api::SolveLifecycle>();
  lifecycle->request_id = request_id;
  lifecycle->method = "POST";
  lifecycle->path = "/api/v1/deliveries/optimize";
  lifecycle->request_started_at = SteadyClock::now();
  return lifecycle;
}

} // namespace

TEST(SolveCoordinatorLifecycleTest, RecordsLifecycleAndGaugeTransitionsForSuccessfulSolve) {
  auto runner = std::make_shared<BlockingRunner>();
  auto observability = std::make_shared<deliveryoptimizer::api::ObservabilityRegistry>();
  deliveryoptimizer::api::SolveCoordinator coordinator(BuildConfig(), runner, {}, observability);

  auto lifecycle = BuildLifecycle("req-success");
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> result_promise;
  auto result_future = result_promise.get_future();

  ASSERT_EQ(coordinator.Submit(
                deliveryoptimizer::api::SolveRequestSize{
                    .jobs = 1U,
                    .vehicles = 1U,
                },
                [] { return Json::Value{Json::objectValue}; },
                [&result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
                  result_promise.set_value(result);
                },
                lifecycle),
            deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);

  runner->WaitUntilStarted();

  EXPECT_TRUE(lifecycle->accepted);
  EXPECT_TRUE(lifecycle->queued_at.has_value());
  EXPECT_TRUE(lifecycle->solve_started_at.has_value());
  EXPECT_EQ(lifecycle->queue_wait_duration, SteadyClock::duration::zero());
  EXPECT_EQ(observability->InflightSolves(), 1U);
  EXPECT_EQ(observability->QueueDepth(), 0U);

  runner->Release();

  const auto result = result_future.get();
  EXPECT_EQ(result.status, deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
  EXPECT_TRUE(lifecycle->completed_at.has_value());
  EXPECT_GE(lifecycle->solve_duration, SteadyClock::duration::zero());
  EXPECT_EQ(observability->InflightSolves(), 0U);
  EXPECT_EQ(observability->QueueDepth(), 0U);
}

TEST(SolveCoordinatorLifecycleTest, RecordsAcceptedBeforeCompletionCallbackRuns) {
  auto runner = std::make_shared<ImmediateRunner>();
  auto observability = std::make_shared<deliveryoptimizer::api::ObservabilityRegistry>();
  deliveryoptimizer::api::SolveCoordinator coordinator(BuildConfig(), runner, {}, observability);

  auto lifecycle = BuildLifecycle("req-accepted-metric");
  std::promise<std::string> metrics_promise;
  auto metrics_future = metrics_promise.get_future();

  ASSERT_EQ(coordinator.Submit(
                deliveryoptimizer::api::SolveRequestSize{
                    .jobs = 1U,
                    .vehicles = 1U,
                },
                [] { return Json::Value{Json::objectValue}; },
                [&metrics_promise,
                 observability](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
                  EXPECT_EQ(result.status,
                            deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
                  metrics_promise.set_value(observability->RenderPrometheusText());
                },
                lifecycle),
            deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);

  const std::string rendered = metrics_future.get();
  EXPECT_NE(rendered.find("deliveryoptimizer_solver_requests_accepted_total 1"), std::string::npos);
}

TEST(SolveCoordinatorLifecycleTest, RecordsQueuedTimeoutAndQueueGaugeTransitions) {
  auto runner = std::make_shared<BlockingRunner>();
  auto observability = std::make_shared<deliveryoptimizer::api::ObservabilityRegistry>();
  deliveryoptimizer::api::SolveCoordinator coordinator(
      deliveryoptimizer::api::SolveAdmissionConfig{
          .max_concurrency = 1U,
          .max_queue_size = 1U,
          .max_queue_wait = std::chrono::milliseconds{50},
          .max_sync_jobs = 5U,
          .max_sync_vehicles = 2U,
      },
      runner,
      deliveryoptimizer::api::SolveCoordinatorOptions{
          .enable_queue_timer = false,
          .completion_worker_count = std::nullopt,
      },
      observability);

  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> first_result_promise;
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> second_result_promise;
  auto first_result_future = first_result_promise.get_future();
  auto second_result_future = second_result_promise.get_future();
  auto first_lifecycle = BuildLifecycle("req-first");
  auto second_lifecycle = BuildLifecycle("req-second");

  ASSERT_EQ(
      coordinator.Submit(
          deliveryoptimizer::api::SolveRequestSize{
              .jobs = 1U,
              .vehicles = 1U,
          },
          [] { return Json::Value{Json::objectValue}; },
          [&first_result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
            first_result_promise.set_value(result);
          },
          first_lifecycle),
      deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);
  runner->WaitUntilStarted();

  ASSERT_EQ(
      coordinator.Submit(
          deliveryoptimizer::api::SolveRequestSize{
              .jobs = 1U,
              .vehicles = 1U,
          },
          [] { return Json::Value{Json::objectValue}; },
          [&second_result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
            second_result_promise.set_value(result);
          },
          second_lifecycle),
      deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);

  EXPECT_EQ(observability->InflightSolves(), 1U);
  EXPECT_EQ(observability->QueueDepth(), 1U);

  std::this_thread::sleep_for(std::chrono::milliseconds{100});
  runner->Release();

  EXPECT_EQ(first_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
  EXPECT_EQ(second_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kQueueWaitTimedOut);
  EXPECT_TRUE(second_lifecycle->completed_at.has_value());
  EXPECT_FALSE(second_lifecycle->solve_started_at.has_value());
  EXPECT_GE(second_lifecycle->queue_wait_duration, std::chrono::milliseconds{50});
  EXPECT_EQ(observability->InflightSolves(), 0U);
  EXPECT_EQ(observability->QueueDepth(), 0U);
}
