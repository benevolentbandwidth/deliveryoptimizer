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

class ImmediateRunner final : public deliveryoptimizer::api::VroomRunner {
public:
  deliveryoptimizer::api::VroomRunResult Run(const Json::Value& input) const override {
    (void)input;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      ++run_count_;
    }
    condition_.notify_all();
    return deliveryoptimizer::api::VroomRunResult{
        .status = deliveryoptimizer::api::VroomRunStatus::kSuccess,
        .output = Json::Value{Json::objectValue},
    };
  }

  [[nodiscard]] std::size_t run_count() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return run_count_;
  }

  [[nodiscard]] bool WaitForRunCount(const std::size_t expected_runs,
                                     const std::chrono::milliseconds timeout) const {
    std::unique_lock<std::mutex> lock(mutex_);
    return condition_.wait_for(lock, timeout,
                               [this, expected_runs] { return run_count_ >= expected_runs; });
  }

private:
  mutable std::mutex mutex_;
  mutable std::condition_variable condition_;
  mutable std::size_t run_count_{0U};
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
          .completion_worker_count = std::nullopt,
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

TEST(SolveCoordinatorTest, QueueTimerExpiresQueuedSolveBehindReservedWorkerSlots) {
  auto runner = std::make_shared<BlockingRunner>();
  auto coordinator = std::make_unique<deliveryoptimizer::api::SolveCoordinator>(
      deliveryoptimizer::api::SolveAdmissionConfig{
          .max_concurrency = 2U,
          .max_queue_size = 1U,
          .max_queue_wait = std::chrono::milliseconds{50},
          .max_sync_jobs = 5U,
          .max_sync_vehicles = 2U,
      },
      runner,
      deliveryoptimizer::api::SolveCoordinatorOptions{
          .enable_queue_timer = true,
          .completion_worker_count = 1U,
          .start_workers = false,
      });
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> first_result_promise;
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> second_result_promise;
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> third_result_promise;
  auto first_result_future = first_result_promise.get_future();
  auto second_result_future = second_result_promise.get_future();
  auto third_result_future = third_result_promise.get_future();
  std::atomic<bool> third_payload_factory_called{false};

  ASSERT_EQ(
      coordinator->Submit(
          deliveryoptimizer::api::SolveRequestSize{
              .jobs = 1U,
              .vehicles = 1U,
          },
          [] { return Json::Value{Json::objectValue}; },
          [&first_result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
            first_result_promise.set_value(result);
          }),
      deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);
  ASSERT_EQ(
      coordinator->Submit(
          deliveryoptimizer::api::SolveRequestSize{
              .jobs = 1U,
              .vehicles = 1U,
          },
          [] { return Json::Value{Json::objectValue}; },
          [&second_result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
            second_result_promise.set_value(result);
          }),
      deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);
  ASSERT_EQ(
      coordinator->Submit(
          deliveryoptimizer::api::SolveRequestSize{
              .jobs = 1U,
              .vehicles = 1U,
          },
          [&third_payload_factory_called] {
            third_payload_factory_called.store(true);
            return Json::Value{Json::objectValue};
          },
          [&third_result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
            third_result_promise.set_value(result);
          }),
      deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);

  EXPECT_EQ(first_result_future.wait_for(std::chrono::milliseconds{100}),
            std::future_status::timeout);
  EXPECT_EQ(second_result_future.wait_for(std::chrono::milliseconds{100}),
            std::future_status::timeout);
  ASSERT_EQ(third_result_future.wait_for(std::chrono::seconds{1}), std::future_status::ready);
  EXPECT_EQ(third_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kQueueWaitTimedOut);
  EXPECT_FALSE(third_payload_factory_called.load());

  coordinator.reset();

  ASSERT_EQ(first_result_future.wait_for(std::chrono::seconds{1}), std::future_status::ready);
  ASSERT_EQ(second_result_future.wait_for(std::chrono::seconds{1}), std::future_status::ready);
  EXPECT_EQ(first_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kFailed);
  EXPECT_EQ(second_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kFailed);
}

TEST(SolveCoordinatorTest, DestructorFailsQueuedSolveBeforeActiveWorkerFinishes) {
  auto runner = std::make_shared<BlockingRunner>();
  auto coordinator = std::make_unique<deliveryoptimizer::api::SolveCoordinator>(
      deliveryoptimizer::api::SolveAdmissionConfig{
          .max_concurrency = 1U,
          .max_queue_size = 1U,
          .max_queue_wait = std::chrono::milliseconds{1000},
          .max_sync_jobs = 5U,
          .max_sync_vehicles = 2U,
      },
      runner,
      deliveryoptimizer::api::SolveCoordinatorOptions{
          .enable_queue_timer = false,
          .completion_worker_count = std::nullopt,
      });
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> first_result_promise;
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> second_result_promise;
  auto first_result_future = first_result_promise.get_future();
  auto second_result_future = second_result_promise.get_future();

  ASSERT_EQ(
      coordinator->Submit(
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
      coordinator->Submit(
          deliveryoptimizer::api::SolveRequestSize{
              .jobs = 1U,
              .vehicles = 1U,
          },
          [] { return Json::Value{Json::objectValue}; },
          [&second_result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
            second_result_promise.set_value(result);
          }),
      deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);

  std::jthread shutdown_thread([&coordinator] { coordinator.reset(); });

  const auto second_status = second_result_future.wait_for(std::chrono::milliseconds{200});
  runner->Release();
  shutdown_thread.join();

  ASSERT_EQ(second_status, std::future_status::ready);
  EXPECT_EQ(second_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kFailed);
  EXPECT_EQ(first_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
}

TEST(SolveCoordinatorTest, AcceptedSolveWithMaximumQueueWaitDoesNotTimeOutImmediately) {
  auto runner = std::make_shared<ImmediateRunner>();
  auto config = BuildConfig();
  config.max_queue_wait = std::chrono::milliseconds::max();
  deliveryoptimizer::api::SolveCoordinator coordinator(
      config, runner,
      deliveryoptimizer::api::SolveCoordinatorOptions{
          .enable_queue_timer = false,
          .completion_worker_count = std::nullopt,
      });
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> result_promise;
  auto result_future = result_promise.get_future();
  std::atomic<bool> payload_factory_called{false};

  ASSERT_EQ(coordinator.Submit(
                deliveryoptimizer::api::SolveRequestSize{
                    .jobs = 1U,
                    .vehicles = 1U,
                },
                [&payload_factory_called] {
                  payload_factory_called.store(true);
                  return Json::Value{Json::objectValue};
                },
                [&result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
                  result_promise.set_value(result);
                }),
            deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);

  EXPECT_EQ(result_future.get().status, deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
  EXPECT_TRUE(payload_factory_called.load());
  EXPECT_EQ(runner->run_count(), 1U);
}

TEST(SolveCoordinatorTest, DestructorWaitsForInFlightSolveToFinish) {
  auto runner = std::make_shared<BlockingRunner>();
  auto coordinator =
      std::make_unique<deliveryoptimizer::api::SolveCoordinator>(BuildConfig(), runner);
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> result_promise;
  auto result_future = result_promise.get_future();

  ASSERT_EQ(coordinator->Submit(
                deliveryoptimizer::api::SolveRequestSize{
                    .jobs = 1U,
                    .vehicles = 1U,
                },
                [] { return Json::Value{Json::objectValue}; },
                [&result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
                  result_promise.set_value(result);
                }),
            deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);

  runner->WaitUntilStarted();

  auto destroy_future = std::async(std::launch::async, [&coordinator] { coordinator.reset(); });
  EXPECT_EQ(destroy_future.wait_for(std::chrono::milliseconds{50}), std::future_status::timeout);

  runner->Release();

  EXPECT_EQ(result_future.get().status, deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
  EXPECT_EQ(destroy_future.wait_for(std::chrono::seconds{1}), std::future_status::ready);
  destroy_future.get();
}

TEST(SolveCoordinatorTest, ExtremelyLargeQueueWaitDoesNotExpireQueuedSolveImmediately) {
  auto runner = std::make_shared<BlockingRunner>();
  deliveryoptimizer::api::SolveCoordinator coordinator(
      deliveryoptimizer::api::SolveAdmissionConfig{
          .max_concurrency = 1U,
          .max_queue_size = 1U,
          .max_queue_wait = std::chrono::milliseconds::max(),
          .max_sync_jobs = 5U,
          .max_sync_vehicles = 2U,
      },
      runner);
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

  EXPECT_EQ(second_result_future.wait_for(std::chrono::milliseconds{100}),
            std::future_status::timeout);

  runner->Release();

  EXPECT_EQ(first_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
  EXPECT_EQ(second_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
  EXPECT_TRUE(second_payload_factory_called.load());
}

TEST(SolveCoordinatorTest, RequestsUsingFreeWorkerSlotsDoNotQueueTimeout) {
  auto runner = std::make_shared<BlockingRunner>();
  deliveryoptimizer::api::SolveCoordinator coordinator(
      deliveryoptimizer::api::SolveAdmissionConfig{
          .max_concurrency = 2U,
          .max_queue_size = 0U,
          .max_queue_wait = std::chrono::milliseconds{0},
          .max_sync_jobs = 5U,
          .max_sync_vehicles = 2U,
      },
      runner);
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> first_result_promise;
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> second_result_promise;
  auto first_result_future = first_result_promise.get_future();
  auto second_result_future = second_result_promise.get_future();

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
  ASSERT_EQ(
      coordinator.Submit(
          deliveryoptimizer::api::SolveRequestSize{
              .jobs = 1U,
              .vehicles = 1U,
          },
          [] { return Json::Value{Json::objectValue}; },
          [&second_result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
            second_result_promise.set_value(result);
          }),
      deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);

  EXPECT_EQ(first_result_future.wait_for(std::chrono::milliseconds{100}),
            std::future_status::timeout);
  EXPECT_EQ(second_result_future.wait_for(std::chrono::milliseconds{100}),
            std::future_status::timeout);

  runner->Release();

  EXPECT_EQ(first_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
  EXPECT_EQ(second_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
}

TEST(SolveCoordinatorTest, ReleasesActiveSolveSlotBeforeRunningCompletionCallback) {
  auto runner = std::make_shared<ImmediateRunner>();
  deliveryoptimizer::api::SolveCoordinator coordinator(
      BuildConfig(), runner,
      deliveryoptimizer::api::SolveCoordinatorOptions{
          .enable_queue_timer = false,
          .completion_worker_count = std::nullopt,
      });
  std::promise<void> first_callback_started_promise;
  auto first_callback_started_future = first_callback_started_promise.get_future();
  std::promise<void> release_first_callback_promise;
  auto release_first_callback_future = release_first_callback_promise.get_future().share();
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> first_result_promise;
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> second_result_promise;
  auto first_result_future = first_result_promise.get_future();
  auto second_result_future = second_result_promise.get_future();

  ASSERT_EQ(
      coordinator.Submit(
          deliveryoptimizer::api::SolveRequestSize{
              .jobs = 1U,
              .vehicles = 1U,
          },
          [] { return Json::Value{Json::objectValue}; },
          [&first_callback_started_promise, &release_first_callback_future,
           &first_result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
            first_callback_started_promise.set_value();
            release_first_callback_future.wait();
            first_result_promise.set_value(result);
          }),
      deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);

  ASSERT_EQ(first_callback_started_future.wait_for(std::chrono::seconds{1}),
            std::future_status::ready);

  const auto second_status = coordinator.Submit(
      deliveryoptimizer::api::SolveRequestSize{
          .jobs = 1U,
          .vehicles = 1U,
      },
      [] { return Json::Value{Json::objectValue}; },
      [&second_result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
        second_result_promise.set_value(result);
      });

  release_first_callback_promise.set_value();

  EXPECT_EQ(second_status, deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);
  EXPECT_EQ(first_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
  if (second_status == deliveryoptimizer::api::SolveAdmissionStatus::kAccepted) {
    EXPECT_EQ(second_result_future.get().status,
              deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
  }
  EXPECT_EQ(runner->run_count(), 2U);
}

TEST(SolveCoordinatorTest, ContinuesRunningQueuedSolvesWhileCompletionCallbackIsBlocked) {
  auto runner = std::make_shared<ImmediateRunner>();
  deliveryoptimizer::api::SolveCoordinator coordinator(
      BuildConfig(), runner,
      deliveryoptimizer::api::SolveCoordinatorOptions{
          .enable_queue_timer = false,
          .completion_worker_count = std::nullopt,
      });
  std::promise<void> first_callback_started_promise;
  auto first_callback_started_future = first_callback_started_promise.get_future();
  std::promise<void> release_first_callback_promise;
  auto release_first_callback_future = release_first_callback_promise.get_future().share();
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> first_result_promise;
  std::promise<deliveryoptimizer::api::CoordinatedSolveResult> second_result_promise;
  auto first_result_future = first_result_promise.get_future();
  auto second_result_future = second_result_promise.get_future();

  ASSERT_EQ(
      coordinator.Submit(
          deliveryoptimizer::api::SolveRequestSize{
              .jobs = 1U,
              .vehicles = 1U,
          },
          [] { return Json::Value{Json::objectValue}; },
          [&first_callback_started_promise, &release_first_callback_future,
           &first_result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
            first_callback_started_promise.set_value();
            release_first_callback_future.wait();
            first_result_promise.set_value(result);
          }),
      deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);

  ASSERT_EQ(first_callback_started_future.wait_for(std::chrono::seconds{1}),
            std::future_status::ready);

  ASSERT_EQ(
      coordinator.Submit(
          deliveryoptimizer::api::SolveRequestSize{
              .jobs = 1U,
              .vehicles = 1U,
          },
          [] { return Json::Value{Json::objectValue}; },
          [&second_result_promise](const deliveryoptimizer::api::CoordinatedSolveResult& result) {
            second_result_promise.set_value(result);
          }),
      deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);

  EXPECT_TRUE(runner->WaitForRunCount(2U, std::chrono::seconds{1}));

  release_first_callback_promise.set_value();

  EXPECT_EQ(first_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
  EXPECT_EQ(second_result_future.get().status,
            deliveryoptimizer::api::CoordinatedSolveStatus::kSucceeded);
}
