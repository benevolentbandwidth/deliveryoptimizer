#include "deliveryoptimizer/api/solve_admission.hpp"

#include <chrono>
#include <gtest/gtest.h>

namespace {

deliveryoptimizer::api::SolveAdmissionConfig BuildConfig() {
  return deliveryoptimizer::api::SolveAdmissionConfig{
      .max_concurrency = 2U,
      .max_queue_size = 3U,
      .max_queue_wait = std::chrono::milliseconds{1000},
      .max_sync_jobs = 5U,
      .max_sync_vehicles = 2U,
  };
}

} // namespace

TEST(SolveAdmissionTest, AcceptsSolveWithinSyncLimitsWhenCapacityIsAvailable) {
  const auto config = BuildConfig();

  EXPECT_EQ(deliveryoptimizer::api::EvaluateSolveAdmission(config,
                                                           deliveryoptimizer::api::SolveRequestSize{
                                                               .jobs = 3U,
                                                               .vehicles = 2U,
                                                           },
                                                           1U, 2U),
            deliveryoptimizer::api::SolveAdmissionStatus::kAccepted);
}

TEST(SolveAdmissionTest, RejectsSolveWhenJobCountExceedsSyncLimit) {
  const auto config = BuildConfig();

  EXPECT_EQ(deliveryoptimizer::api::EvaluateSolveAdmission(config,
                                                           deliveryoptimizer::api::SolveRequestSize{
                                                               .jobs = 6U,
                                                               .vehicles = 1U,
                                                           },
                                                           0U, 0U),
            deliveryoptimizer::api::SolveAdmissionStatus::kRejectedTooManyJobs);
}

TEST(SolveAdmissionTest, RejectsSolveWhenVehicleCountExceedsSyncLimit) {
  const auto config = BuildConfig();

  EXPECT_EQ(deliveryoptimizer::api::EvaluateSolveAdmission(config,
                                                           deliveryoptimizer::api::SolveRequestSize{
                                                               .jobs = 2U,
                                                               .vehicles = 3U,
                                                           },
                                                           0U, 0U),
            deliveryoptimizer::api::SolveAdmissionStatus::kRejectedTooManyVehicles);
}

TEST(SolveAdmissionTest, RejectsSolveWhenWorkersAndQueueAreFull) {
  const auto config = BuildConfig();

  EXPECT_EQ(deliveryoptimizer::api::EvaluateSolveAdmission(config,
                                                           deliveryoptimizer::api::SolveRequestSize{
                                                               .jobs = 2U,
                                                               .vehicles = 1U,
                                                           },
                                                           2U, 3U),
            deliveryoptimizer::api::SolveAdmissionStatus::kRejectedQueueFull);
}

TEST(SolveAdmissionTest, RejectsSolveWhenPendingAcceptedSolveAlreadyConsumesOnlyWorkerSlot) {
  const deliveryoptimizer::api::SolveAdmissionConfig config{
      .max_concurrency = 1U,
      .max_queue_size = 0U,
      .max_queue_wait = std::chrono::milliseconds{1000},
      .max_sync_jobs = 5U,
      .max_sync_vehicles = 2U,
  };

  EXPECT_EQ(deliveryoptimizer::api::EvaluateSolveAdmission(config,
                                                           deliveryoptimizer::api::SolveRequestSize{
                                                               .jobs = 1U,
                                                               .vehicles = 1U,
                                                           },
                                                           0U, 1U),
            deliveryoptimizer::api::SolveAdmissionStatus::kRejectedQueueFull);
}
