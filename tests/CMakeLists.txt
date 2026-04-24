find_package(GTest CONFIG REQUIRED)
find_package(jsoncpp CONFIG REQUIRED)
include(GoogleTest)

set(
  DELIVERYOPTIMIZER_TEST_COMPONENT_DIRS
  api
  adapters
  application
  config
  domain
)

set(DELIVERYOPTIMIZER_TEST_SOURCES)
foreach(component_dir IN LISTS DELIVERYOPTIMIZER_TEST_COMPONENT_DIRS)
  file(
    GLOB_RECURSE component_sources
    CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/${component_dir}/*.cpp"
  )
  list(APPEND DELIVERYOPTIMIZER_TEST_SOURCES ${component_sources})
endforeach()
list(SORT DELIVERYOPTIMIZER_TEST_SOURCES)

add_executable(deliveryoptimizer_tests ${DELIVERYOPTIMIZER_TEST_SOURCES})
target_sources(
  deliveryoptimizer_tests
  PRIVATE
    "${CMAKE_SOURCE_DIR}/app/api/src/observability.cpp"
    "${CMAKE_SOURCE_DIR}/app/api/src/optimize_request.cpp"
    "${CMAKE_SOURCE_DIR}/app/api/src/solve_admission.cpp"
    "${CMAKE_SOURCE_DIR}/app/api/src/solve_coordinator.cpp"
    "${CMAKE_SOURCE_DIR}/app/api/src/server_options.cpp"
)
target_compile_features(deliveryoptimizer_tests PRIVATE cxx_std_20)
target_compile_definitions(
  deliveryoptimizer_tests
  PRIVATE
    DELIVERYOPTIMIZER_SOURCE_DIR="${CMAKE_SOURCE_DIR}"
)
target_include_directories(deliveryoptimizer_tests PRIVATE "${CMAKE_SOURCE_DIR}/app/api/include")
target_link_libraries(
  deliveryoptimizer_tests
  PRIVATE
    deliveryoptimizer::adapters
    GTest::gtest_main
    JsonCpp::JsonCpp
)
add_dependencies(deliveryoptimizer_tests deliveryoptimizer_api)

if(DELIVERYOPTIMIZER_ENABLE_WARNINGS)
  deliveryoptimizer_set_warnings(deliveryoptimizer_tests)
endif()

gtest_discover_tests(
  deliveryoptimizer_tests
  DISCOVERY_TIMEOUT 30
  PROPERTIES
    LABELS "unit"
)

if(DEFINED BASH_PROGRAM AND NOT EXISTS "${BASH_PROGRAM}")
  unset(BASH_PROGRAM CACHE)
endif()
if(DEFINED CURL_PROGRAM AND NOT EXISTS "${CURL_PROGRAM}")
  unset(CURL_PROGRAM CACHE)
endif()
if(DEFINED PYTHON3_PROGRAM AND NOT EXISTS "${PYTHON3_PROGRAM}")
  unset(PYTHON3_PROGRAM CACHE)
endif()
if(DEFINED INITDB_PROGRAM AND NOT EXISTS "${INITDB_PROGRAM}")
  unset(INITDB_PROGRAM CACHE)
endif()
if(DEFINED PG_CTL_PROGRAM AND NOT EXISTS "${PG_CTL_PROGRAM}")
  unset(PG_CTL_PROGRAM CACHE)
endif()
if(DEFINED PSQL_PROGRAM AND NOT EXISTS "${PSQL_PROGRAM}")
  unset(PSQL_PROGRAM CACHE)
endif()

find_program(BASH_PROGRAM bash REQUIRED)
find_program(CURL_PROGRAM curl REQUIRED)
find_program(PYTHON3_PROGRAM python3 REQUIRED)
find_program(INITDB_PROGRAM initdb)
find_program(PG_CTL_PROGRAM pg_ctl)
find_program(PSQL_PROGRAM psql)
find_program(DOCKER_PROGRAM docker)

set(DELIVERYOPTIMIZER_LOCAL_API_LABELS "integration;api;local")
set(DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS "integration;api;local;regression")
set(DELIVERYOPTIMIZER_LOCAL_HTTP_SAFE_MIN_PORT 10000)
set(DELIVERYOPTIMIZER_LOCAL_HTTP_SAFE_MAX_PORT 32767)

function(deliveryoptimizer_resolve_local_http_test_port output_var port)
  if(NOT "${port}" MATCHES "^[0-9]+$" OR "${port}" LESS 1 OR "${port}" GREATER 65535)
    message(FATAL_ERROR "Invalid local HTTP test port '${port}'")
  endif()

  if("${port}" GREATER_EQUAL "${DELIVERYOPTIMIZER_LOCAL_HTTP_SAFE_MIN_PORT}"
     AND "${port}" LESS_EQUAL "${DELIVERYOPTIMIZER_LOCAL_HTTP_SAFE_MAX_PORT}")
    set(${output_var} "${port}" PARENT_SCOPE)
    return()
  endif()

  math(EXPR safe_port_window
       "${DELIVERYOPTIMIZER_LOCAL_HTTP_SAFE_MAX_PORT} - ${DELIVERYOPTIMIZER_LOCAL_HTTP_SAFE_MIN_PORT} + 1")
  math(EXPR safe_port_offset
       "(${port} - ${DELIVERYOPTIMIZER_LOCAL_HTTP_SAFE_MIN_PORT}) % ${safe_port_window}")
  if(safe_port_offset LESS 0)
    math(EXPR safe_port_offset "${safe_port_offset} + ${safe_port_window}")
  endif()
  math(EXPR safe_port "${DELIVERYOPTIMIZER_LOCAL_HTTP_SAFE_MIN_PORT} + ${safe_port_offset}")
  set(${output_var} "${safe_port}" PARENT_SCOPE)
endfunction()

function(deliveryoptimizer_set_local_http_test_port test_name port)
  deliveryoptimizer_resolve_local_http_test_port(safe_port "${port}")
  set_tests_properties(
    ${test_name}
    PROPERTIES
      ENVIRONMENT "DELIVERYOPTIMIZER_TEST_PORT=${safe_port}"
  )
endfunction()

function(deliveryoptimizer_set_local_http_test_environment test_name environment)
  set_tests_properties(
    ${test_name}
    PROPERTIES
      ENVIRONMENT "${environment}"
  )
endfunction()

function(deliveryoptimizer_add_local_http_test test_name script_name timeout_seconds labels)
  add_test(
    NAME ${test_name}
    COMMAND "${BASH_PROGRAM}" "${CMAKE_CURRENT_SOURCE_DIR}/integration/http_server/${script_name}"
            "$<TARGET_FILE:deliveryoptimizer_api>" "${CURL_PROGRAM}"
  )
  set_tests_properties(
    ${test_name}
    PROPERTIES
      TIMEOUT ${timeout_seconds}
      LABELS "${labels}"
  )
endfunction()

function(deliveryoptimizer_add_local_http_pg_test test_name script_name timeout_seconds labels)
  add_test(
    NAME ${test_name}
    COMMAND "${BASH_PROGRAM}" "${CMAKE_CURRENT_SOURCE_DIR}/integration/http_server/${script_name}"
            "$<TARGET_FILE:deliveryoptimizer_api>" "${CURL_PROGRAM}" "${PYTHON3_PROGRAM}"
            "${INITDB_PROGRAM}" "${PG_CTL_PROGRAM}"
  )
  set_tests_properties(
    ${test_name}
    PROPERTIES
      TIMEOUT ${timeout_seconds}
      LABELS "${labels}"
  )
endfunction()

deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiTest.HealthAndOptimize
  health_and_optimize_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(DeliveryOptimizerApiTest.HealthAndOptimize 20000)

deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiValidationTest.OptimizeRejectsNegativeDeliveries
  optimize_rejects_negative_deliveries_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiValidationTest.OptimizeRejectsNegativeDeliveries
  21000
)

deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiValidationTest.OptimizeRejectsExcessiveDeliveries
  optimize_rejects_excessive_deliveries_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiValidationTest.OptimizeRejectsExcessiveDeliveries
  22000
)

deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiValidationTest.OptimizeRejectsMalformedDeliveries
  optimize_rejects_malformed_deliveries_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiValidationTest.OptimizeRejectsMalformedDeliveries
  23000
)

add_test(
  NAME DeliveryOptimizerApiValidationTest.DeliveriesOptimizeRejectsExcessiveBodySize
  COMMAND "${BASH_PROGRAM}"
          "${CMAKE_CURRENT_SOURCE_DIR}/integration/http_server/deliveries_optimize_rejects_excessive_body_size_test.sh"
          "$<TARGET_FILE:deliveryoptimizer_api>" "${PYTHON3_PROGRAM}" "${CURL_PROGRAM}"
)
set_tests_properties(
  DeliveryOptimizerApiValidationTest.DeliveriesOptimizeRejectsExcessiveBodySize
  PROPERTIES
    TIMEOUT 30
    LABELS "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiValidationTest.DeliveriesOptimizeRejectsExcessiveBodySize
  23200
)

add_test(
  NAME DeliveryOptimizerApiValidationTest.DeliveriesOptimizeRejectsHugeContentLengthEarly
  COMMAND "${BASH_PROGRAM}"
          "${CMAKE_CURRENT_SOURCE_DIR}/integration/http_server/deliveries_optimize_rejects_huge_content_length_early_test.sh"
          "$<TARGET_FILE:deliveryoptimizer_api>" "${PYTHON3_PROGRAM}" "${CURL_PROGRAM}"
)
set_tests_properties(
  DeliveryOptimizerApiValidationTest.DeliveriesOptimizeRejectsHugeContentLengthEarly
  PROPERTIES
    TIMEOUT 30
    LABELS "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiValidationTest.DeliveriesOptimizeRejectsHugeContentLengthEarly
  23100
)

deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiValidationTest.DeliveriesOptimizeRejectsMalformedJsonWithRequestId
  deliveries_optimize_rejects_malformed_json_with_request_id_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiValidationTest.DeliveriesOptimizeRejectsMalformedJsonWithRequestId
  29100
)

add_test(
  NAME DeliveryOptimizerApiContractTest.OsrmProxyForwardsAllowedServiceWithQuery
  COMMAND "${BASH_PROGRAM}"
          "${CMAKE_CURRENT_SOURCE_DIR}/integration/http_server/osrm_proxy_forwards_allowed_service_with_query_test.sh"
          "$<TARGET_FILE:deliveryoptimizer_api>" "${PYTHON3_PROGRAM}" "${CURL_PROGRAM}"
)
set_tests_properties(
  DeliveryOptimizerApiContractTest.OsrmProxyForwardsAllowedServiceWithQuery
  PROPERTIES
    TIMEOUT 30
    LABELS "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_resolve_local_http_test_port(osrm_proxy_test_port 36000)
deliveryoptimizer_resolve_local_http_test_port(osrm_stub_test_port 52100)
deliveryoptimizer_set_local_http_test_environment(
  DeliveryOptimizerApiContractTest.OsrmProxyForwardsAllowedServiceWithQuery
  "DELIVERYOPTIMIZER_TEST_PORT=${osrm_proxy_test_port};DELIVERYOPTIMIZER_OSRM_STUB_PORT=${osrm_stub_test_port}"
)

deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiContractTest.OsrmProxyRejectsDisallowedService
  osrm_proxy_rejects_disallowed_service_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiContractTest.OsrmProxyRejectsDisallowedService
  34000
)

deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiContractTest.DeliveriesOptimizePreservesVehicleStartEnd
  deliveries_optimize_preserves_vehicle_start_end_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiContractTest.DeliveriesOptimizePreservesVehicleStartEnd
  24000
)

deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiContractTest.DeliveriesOptimizeResponseIncludesExternalIds
  deliveries_optimize_response_includes_external_ids_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiContractTest.DeliveriesOptimizeResponseIncludesExternalIds
  25000
)

deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiContractTest.HealthReportsDependencyReadiness
  health_reports_dependency_readiness_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiContractTest.HealthReportsDependencyReadiness
  26000
)

deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiContractTest.DeliveriesOptimizeMissingServiceDefaultsTo300
  deliveries_optimize_missing_service_defaults_to_300_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiContractTest.DeliveriesOptimizeMissingServiceDefaultsTo300
  27000
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiContractTest.DeliveriesOptimizeMissingDemandDefaultsTo1
  deliveries_optimize_missing_demand_defaults_to_1_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiContractTest.DeliveriesOptimizeMissingDemandDefaultsTo1
  28000
)
add_test(
  NAME DeliveryOptimizerTestHarnessTest.HttpServerHelpersKeepPortInRange
  COMMAND "${BASH_PROGRAM}"
          "${CMAKE_CURRENT_SOURCE_DIR}/integration/http_server/http_server_helpers_keep_port_in_range_test.sh"
)
set_tests_properties(
  DeliveryOptimizerTestHarnessTest.HttpServerHelpersKeepPortInRange
  PROPERTIES
    TIMEOUT 30
    LABELS "integration;local;regression"
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsInvalidVehicleTimeWindow
  deliveries_optimize_rejects_invalid_vehicle_time_window_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsInvalidVehicleTimeWindow
  29000
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizePreservesVehicleTimeWindow
  deliveries_optimize_preserves_vehicle_time_window_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizePreservesVehicleTimeWindow
  30000
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsInvalidJobTimeWindows
  deliveries_optimize_rejects_invalid_job_time_windows_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsInvalidJobTimeWindows
  31000
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizePreservesJobTimeWindows
  deliveries_optimize_preserves_job_time_windows_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizePreservesJobTimeWindows
  32000
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsEmptyJobTimeWindows
  deliveries_optimize_rejects_empty_job_time_windows_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsEmptyJobTimeWindows
  33000
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeEnforcesSolverTimeout
  deliveries_optimize_enforces_solver_timeout_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeEnforcesSolverTimeout
  37000
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsOutOfRangeCoordinates
  deliveries_optimize_rejects_out_of_range_coordinates_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsOutOfRangeCoordinates
  38000
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsExcessiveVehicles
  deliveries_optimize_rejects_excessive_vehicles_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsExcessiveVehicles
  39000
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsExcessiveJobs
  deliveries_optimize_rejects_excessive_jobs_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsExcessiveJobs
  40000
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsExcessiveVroomOutput
  deliveries_optimize_rejects_excessive_vroom_output_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsExcessiveVroomOutput
  41000
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiValidationTest.MetricsEndpointDisabledByDefault
  metrics_endpoint_disabled_by_default_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiValidationTest.MetricsEndpointDisabledByDefault
  38100
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeIgnoresMalformedVroomRouteEntries
  deliveries_optimize_ignores_malformed_vroom_route_entries_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeIgnoresMalformedVroomRouteEntries
  38300
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiValidationTest.DeliveriesOptimizeEndpointDisabledByDefault
  deliveries_optimize_endpoint_disabled_by_default_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiValidationTest.DeliveriesOptimizeEndpointDisabledByDefault
  38200
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeAcceptsSmallSyncSolve
  deliveries_optimize_accepts_small_sync_solve_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeAcceptsSmallSyncSolve
  46000
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsOverThresholdSyncSolve
  deliveries_optimize_rejects_over_threshold_sync_solve_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsOverThresholdSyncSolve
  47000
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsWhenAdmissionQueueIsFull
  deliveries_optimize_rejects_when_admission_queue_is_full_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsWhenAdmissionQueueIsFull
  48000
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsWhenQueueWaitExpires
  deliveries_optimize_rejects_when_queue_wait_expires_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsWhenQueueWaitExpires
  49000
)

if(INITDB_PROGRAM AND PG_CTL_PROGRAM)
  deliveryoptimizer_add_local_http_pg_test(
    DeliveryOptimizerApiAsyncTest.OptimizationJobsEndToEnd
    optimization_jobs_end_to_end_test.sh
    60
    "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
  )
  deliveryoptimizer_set_local_http_test_port(
    DeliveryOptimizerApiAsyncTest.OptimizationJobsEndToEnd
    52000
  )

  deliveryoptimizer_add_local_http_pg_test(
    DeliveryOptimizerApiAsyncTest.OptimizationJobResultReturnsAcceptedWhileRunning
    optimization_job_result_conflict_while_running_test.sh
    60
    "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
  )
  deliveryoptimizer_set_local_http_test_port(
    DeliveryOptimizerApiAsyncTest.OptimizationJobResultReturnsAcceptedWhileRunning
    53000
  )

  deliveryoptimizer_add_local_http_pg_test(
    DeliveryOptimizerApiAsyncTest.RetriedJobKeepsLatestWorkerResult
    optimization_job_retried_worker_cannot_clobber_result_test.sh
    60
    "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
  )
  deliveryoptimizer_set_local_http_test_port(
    DeliveryOptimizerApiAsyncTest.RetriedJobKeepsLatestWorkerResult
    54000
  )

  deliveryoptimizer_add_local_http_pg_test(
    DeliveryOptimizerApiAsyncTest.RejectsWhenAsyncQueueIsFull
    optimization_jobs_reject_when_queue_is_full_test.sh
    60
    "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
  )
  deliveryoptimizer_set_local_http_test_port(
    DeliveryOptimizerApiAsyncTest.RejectsWhenAsyncQueueIsFull
    57000
  )

  deliveryoptimizer_add_local_http_pg_test(
    DeliveryOptimizerApiAsyncTest.ExpiredLeaseFailsAfterMaxAttempts
    optimization_job_expired_lease_fails_after_max_attempts_test.sh
    60
    "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
  )
  deliveryoptimizer_set_local_http_test_port(
    DeliveryOptimizerApiAsyncTest.ExpiredLeaseFailsAfterMaxAttempts
    58000
  )

  deliveryoptimizer_add_local_http_pg_test(
    DeliveryOptimizerApiAsyncTest.ResultReturnsConflictAfterTerminalFailure
    optimization_job_result_conflict_after_terminal_failure_test.sh
    60
    "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
  )
  deliveryoptimizer_set_local_http_test_port(
    DeliveryOptimizerApiAsyncTest.ResultReturnsConflictAfterTerminalFailure
    59000
  )

  if(PSQL_PROGRAM)
    add_test(
      NAME DeliveryOptimizerApiContractTest.HealthReportsSchemaBootstrapFailure
      COMMAND "${BASH_PROGRAM}"
              "${CMAKE_CURRENT_SOURCE_DIR}/integration/http_server/health_reports_schema_bootstrap_failure_test.sh"
              "$<TARGET_FILE:deliveryoptimizer_api>" "${CURL_PROGRAM}" "${PYTHON3_PROGRAM}"
              "${INITDB_PROGRAM}" "${PG_CTL_PROGRAM}" "${PSQL_PROGRAM}"
    )
    set_tests_properties(
      DeliveryOptimizerApiContractTest.HealthReportsSchemaBootstrapFailure
      PROPERTIES
        TIMEOUT 60
        LABELS "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
    )
    deliveryoptimizer_set_local_http_test_port(
      DeliveryOptimizerApiContractTest.HealthReportsSchemaBootstrapFailure
      55000
    )

    add_test(
      NAME DeliveryOptimizerApiAsyncTest.WorkersUseProcessUniqueIds
      COMMAND "${BASH_PROGRAM}"
              "${CMAKE_CURRENT_SOURCE_DIR}/integration/http_server/optimization_job_workers_use_process_unique_ids_test.sh"
              "$<TARGET_FILE:deliveryoptimizer_api>" "${CURL_PROGRAM}" "${PYTHON3_PROGRAM}"
              "${INITDB_PROGRAM}" "${PG_CTL_PROGRAM}" "${PSQL_PROGRAM}"
    )
    set_tests_properties(
      DeliveryOptimizerApiAsyncTest.WorkersUseProcessUniqueIds
      PROPERTIES
        TIMEOUT 60
        LABELS "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
    )

    add_test(
      NAME DeliveryOptimizerApiContractTest.HealthIgnoresForeignWorkers
      COMMAND "${BASH_PROGRAM}"
              "${CMAKE_CURRENT_SOURCE_DIR}/integration/http_server/optimization_job_health_ignores_foreign_workers_test.sh"
              "$<TARGET_FILE:deliveryoptimizer_api>" "${CURL_PROGRAM}" "${PYTHON3_PROGRAM}"
              "${INITDB_PROGRAM}" "${PG_CTL_PROGRAM}" "${PSQL_PROGRAM}"
    )
    set_tests_properties(
      DeliveryOptimizerApiContractTest.HealthIgnoresForeignWorkers
      PROPERTIES
        TIMEOUT 60
        LABELS "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
    )
    deliveryoptimizer_set_local_http_test_port(
      DeliveryOptimizerApiContractTest.HealthIgnoresForeignWorkers
      60000
    )
  else()
    message(STATUS "Skipping schema bootstrap health test because psql was not found.")
  endif()
else()
  message(STATUS "Skipping local PostgreSQL-backed HTTP tests because initdb or pg_ctl was not found.")
endif()

if(DOCKER_PROGRAM)
  set(DELIVERYOPTIMIZER_E2E_ENV_FILE "${CMAKE_SOURCE_DIR}/tests/integration/e2e/e2e_stack.env")
  set(DELIVERYOPTIMIZER_E2E_COMPOSE_FILE "${CMAKE_SOURCE_DIR}/deploy/compose/docker-compose.arm64.yml")

  function(deliveryoptimizer_add_docker_e2e_test test_name script_name timeout_seconds)
    add_test(
      NAME ${test_name}
      COMMAND "${BASH_PROGRAM}" "${CMAKE_CURRENT_SOURCE_DIR}/integration/e2e/${script_name}"
              "${DELIVERYOPTIMIZER_E2E_ENV_FILE}" "${DELIVERYOPTIMIZER_E2E_COMPOSE_FILE}"
              "${DOCKER_PROGRAM}" "${CURL_PROGRAM}"
    )
    set_tests_properties(
      ${test_name}
      PROPERTIES
        RUN_SERIAL TRUE
        TIMEOUT ${timeout_seconds}
        LABELS "e2e;docker"
    )
  endfunction()

  function(deliveryoptimizer_add_docker_api_e2e_test test_name script_name timeout_seconds)
    add_test(
      NAME ${test_name}
      COMMAND "${BASH_PROGRAM}" "${CMAKE_CURRENT_SOURCE_DIR}/integration/e2e/${script_name}"
              "${DELIVERYOPTIMIZER_E2E_ENV_FILE}" "${DELIVERYOPTIMIZER_E2E_COMPOSE_FILE}"
              "${DOCKER_PROGRAM}" "${CURL_PROGRAM}"
    )
    set_tests_properties(
      ${test_name}
      PROPERTIES
        RUN_SERIAL TRUE
        TIMEOUT ${timeout_seconds}
        LABELS "e2e;docker;api"
    )
  endfunction()

  function(deliveryoptimizer_add_docker_api_e2e_python_test test_name script_name timeout_seconds)
    add_test(
      NAME ${test_name}
      COMMAND "${BASH_PROGRAM}" "${CMAKE_CURRENT_SOURCE_DIR}/integration/e2e/${script_name}"
              "${DELIVERYOPTIMIZER_E2E_ENV_FILE}" "${DELIVERYOPTIMIZER_E2E_COMPOSE_FILE}"
              "${DOCKER_PROGRAM}" "${CURL_PROGRAM}" "${PYTHON3_PROGRAM}"
    )
    set_tests_properties(
      ${test_name}
      PROPERTIES
        RUN_SERIAL TRUE
        TIMEOUT ${timeout_seconds}
        LABELS "e2e;docker;api"
    )
  endfunction()

  add_test(
    NAME DeliveryOptimizerRoutingSmokeTest.OsrmAndVroom
    COMMAND
      "${BASH_PROGRAM}" "${CMAKE_CURRENT_SOURCE_DIR}/integration/routing/osrm_and_vroom_smoketest.sh"
      "${CMAKE_SOURCE_DIR}/tests/integration/routing/routing_smoketest.env"
      "${CMAKE_SOURCE_DIR}/deploy/compose/docker-compose.arm64.yml"
      "${DOCKER_PROGRAM}" "${CURL_PROGRAM}"
  )
  # Keep this out of the default preset because it builds/pulls the full routing stack and is
  # intended as an explicit smoke check rather than a fast per-PR validation step.
  set_tests_properties(
    DeliveryOptimizerRoutingSmokeTest.OsrmAndVroom
    PROPERTIES
      RUN_SERIAL TRUE
      TIMEOUT 1800
      DISABLED TRUE
      LABELS "e2e;docker;routing;smoke"
  )

  deliveryoptimizer_add_docker_e2e_test(
    DeliveryOptimizerE2ETest.VroomHelpIsAvailable
    vroom_help_is_available_e2e_test.sh
    1800
  )
  deliveryoptimizer_add_docker_api_e2e_test(
    DeliveryOptimizerE2ETest.HealthEndpointReturnsOk
    health_endpoint_returns_ok_e2e_test.sh
    1800
  )
  deliveryoptimizer_add_docker_api_e2e_test(
    DeliveryOptimizerE2ETest.OptimizeValidQueryReturnsSummary
    optimize_valid_query_returns_summary_e2e_test.sh
    1800
  )
  deliveryoptimizer_add_docker_api_e2e_test(
    DeliveryOptimizerE2ETest.OptimizeRejectsNegativeDeliveries
    optimize_rejects_negative_deliveries_e2e_test.sh
    1800
  )
  deliveryoptimizer_add_docker_api_e2e_test(
    DeliveryOptimizerE2ETest.OptimizeRejectsExcessiveDeliveries
    optimize_rejects_excessive_deliveries_e2e_test.sh
    1800
  )

  deliveryoptimizer_add_docker_api_e2e_python_test(
    DeliveryOptimizerE2ETest.OptimizationJobValidPayloadReturnsRoutingResponse
    optimization_job_valid_payload_returns_routing_response_e2e_test.sh
    2400
  )
  deliveryoptimizer_add_docker_api_e2e_test(
    DeliveryOptimizerE2ETest.OsrmProxyNearestReturnsOk
    osrm_proxy_nearest_returns_ok_e2e_test.sh
    2400
  )
  deliveryoptimizer_add_docker_api_e2e_test(
    DeliveryOptimizerE2ETest.OsrmProxyBlocksTileService
    osrm_proxy_blocks_tile_service_e2e_test.sh
    2400
  )
endif()
