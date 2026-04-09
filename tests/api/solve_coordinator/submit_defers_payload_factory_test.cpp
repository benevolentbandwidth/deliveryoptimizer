#include "deliveryoptimizer/api/solve_coordinator.hpp"
#include "deliveryoptimizer/api/vroom_runner.hpp"

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <future>
#include <gtest/gtest.h>
#include <json/json.h>
#include <memory>
#include <mutex>
#include <thread>

namespace {

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

deliveryoptimizer::api::SolveAdmissionConfig BuildConfig() {
  return deliveryoptimizer::api::SolveAdmissionConfig{
      .max_concurrency = 1U,
      .max_queue_size = 0U,
      .max_queue_wait = std::chrono::milliseconds{1000},
      .max_sync_jobs = 5U,
      .max_sync_vehicles = 2U,
  };
}

} // namespace

TEST(SolveCoordinatorTest, DoesNotInvokePayloadFactoryWhenSolveIsRejectedForSyncSize) {
  auto runner = std::make_shared<BlockingRunner>();
  deliveryoptimizer::api::SolveCoordinator coordinator(BuildConfig(), runner);
  std::atomic<bool> payload_factory_called{false};

  const auto status = coordinator.Submit(
      deliveryoptimizer::api::SolveRequestSize{
          .jobs = 6U,
          .vehicles = 1U,
      },
      [&payload_factory_called] {
        payload_factory_called.store(true);
        return Json::Value{Json::objectValue};
      },
      [](const deliveryoptimizer::api::CoordinatedSolveResult&) {
        FAIL() << "callback should not run";
      });

  EXPECT_EQ(status, deliveryoptimizer::api::SolveAdmissionStatus::kRejectedTooManyJobs);
  EXPECT_FALSE(payload_factory_called.load());
}

TEST(SolveCoordinatorTest, DoesNotInvokePayloadFactoryWhenSolveIsRejectedForQueueFull) {
  auto runner = std::make_shared<BlockingRunner>();
  deliveryoptimizer::api::SolveCoordinator coordinator(BuildConfig(), runner);
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> first_result_promise;
  auto first_result_future = first_result_promise.get_future();
  std::atomic<bool> first_payload_factory_called{false};
  std::atomic<bool> second_payload_factory_called{false};

  ASSERT_EQ(
      coordinator.Submit(
          deliveryoptimizer::api::SolveRequestSize{
              .jobs = 1U,
              .vehicles = 1U,
          },
          [&first_payload_factory_called] {
            first_payload_factory_called.store(true);
            return Json::Value{Json::objectValue};
          },
          [&first_result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
            first_result_promise.set_value(result);
          }),
      deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);

  runner->WaitUntilStarted();

  const auto second_status = coordinator.Submit(
      deliveryoptimizer::api::SolveRequestSize{
          .jobs = 1U,
          .vehicles = 1U,
      },
      [&second_payload_factory_called] {
        second_payload_factory_called.store(true);
        return Json::Value{Json::objectValue};
      },
      [](const deliveryoptimizer::api::CoordinatedSolveResult&) {
        FAIL() << "callback should not run";
      });

  EXPECT_EQ(second_status, deliveryoptimizer::api::SolveAdmissionStatus::kRejectedQueueFull);
  EXPECT_TRUE(first_payload_factory_called.load());
  EXPECT_FALSE(second_payload_factory_called.load());

  runner->Release();
  EXPECT_EQ(first_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
}

TEST(SolveCoordinatorTest, WorkerRejectsQueuedSolveThatExpiredBeforeDequeue) {
  auto runner = std::make_shared<BlockingRunner>();
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
      });
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> first_result_promise;
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> second_result_promise;
  auto first_result_future = first_result_promise.get_future();
  auto second_result_future = second_result_promise.get_future();
  std::atomic<bool> second_payload_factory_called{false};

  ASSERT_EQ(
      coordinator.Submit(
          deliveryoptimizer::api::SolveRequestSize{
              .jobs = 1U,
              .vehicles = 1U,
          },
          [] { return Json::Value{Json::objectValue}; },
          [&first_result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
            first_result_promise.set_value(result);
          }),
      deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);
  runner->WaitUntilStarted();

  ASSERT_EQ(
      coordinator.Submit(
          deliveryoptimizer::api::SolveRequestSize{
              .jobs = 1U,
              .vehicles = 1U,
          },
          [&second_payload_factory_called] {
            second_payload_factory_called.store(true);
            return Json::Value{Json::objectValue};
          },
          [&second_result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
            second_result_promise.set_value(result);
          }),
      deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);

  std::this_thread::sleep_for(std::chrono::milliseconds{100});
  runner->Release();

  EXPECT_EQ(first_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
  EXPECT_EQ(second_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kQueueWaitTimedOut);
  EXPECT_FALSE(second_payload_factory_called.load());
}
