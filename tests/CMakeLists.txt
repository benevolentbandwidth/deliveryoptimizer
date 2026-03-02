find_package(GTest CONFIG REQUIRED)
find_package(jsoncpp CONFIG REQUIRED)
include(GoogleTest)

set(
  DELIVERYOPTIMIZER_TEST_COMPONENT_DIRS
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

find_program(BASH_PROGRAM bash REQUIRED)
find_program(CURL_PROGRAM curl REQUIRED)
find_program(PYTHON3_PROGRAM python3 REQUIRED)
find_program(DOCKER_PROGRAM docker)

set(DELIVERYOPTIMIZER_LOCAL_API_LABELS "integration;api;local")
set(DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS "integration;api;local;regression")

function(deliveryoptimizer_set_local_http_test_port test_name port)
  set_tests_properties(
    ${test_name}
    PROPERTIES
      ENVIRONMENT "DELIVERYOPTIMIZER_TEST_PORT=${port}"
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
  23000
)

deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerOsrmProxyTest.RejectsDisallowedService
  osrm_proxy_rejects_disallowed_service_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(DeliveryOptimizerOsrmProxyTest.RejectsDisallowedService 34000)

deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerOsrmProxyTest.RejectsTripService
  osrm_proxy_rejects_trip_service_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_port(DeliveryOptimizerOsrmProxyTest.RejectsTripService 35000)

add_test(
  NAME DeliveryOptimizerOsrmProxyTest.ForwardsAllowedServiceWithQueryString
  COMMAND "${BASH_PROGRAM}"
          "${CMAKE_CURRENT_SOURCE_DIR}/integration/http_server/osrm_proxy_forwards_allowed_service_with_query_test.sh"
          "$<TARGET_FILE:deliveryoptimizer_api>" "${PYTHON3_PROGRAM}" "${CURL_PROGRAM}"
)
set_tests_properties(
  DeliveryOptimizerOsrmProxyTest.ForwardsAllowedServiceWithQueryString
  PROPERTIES
    TIMEOUT 30
    LABELS "${DELIVERYOPTIMIZER_LOCAL_API_LABELS}"
)
deliveryoptimizer_set_local_http_test_environment(
  DeliveryOptimizerOsrmProxyTest.ForwardsAllowedServiceWithQueryString
  "DELIVERYOPTIMIZER_TEST_PORT=36000;DELIVERYOPTIMIZER_OSRM_STUB_PORT=52000"
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
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsExcessiveJobs
  deliveries_optimize_rejects_excessive_jobs_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)
deliveryoptimizer_add_local_http_test(
  DeliveryOptimizerApiRegressionTest.DeliveriesOptimizeRejectsExcessiveVroomOutput
  deliveries_optimize_rejects_excessive_vroom_output_test.sh
  30
  "${DELIVERYOPTIMIZER_LOCAL_API_REGRESSION_LABELS}"
)

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
    DeliveryOptimizerE2ETest.OsrmNearestReturnsOk
    osrm_nearest_returns_ok_e2e_test.sh
    1800
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
  deliveryoptimizer_add_docker_api_e2e_test(
    DeliveryOptimizerE2ETest.DeliveriesOptimizeValidPayloadReturnsRoutingResponse
    deliveries_optimize_valid_payload_returns_routing_response_e2e_test.sh
    2400
  )
  deliveryoptimizer_add_docker_api_e2e_test(
    DeliveryOptimizerE2ETest.DeliveriesOptimizeInvalidPayloadReturnsValidationError
    deliveries_optimize_invalid_payload_returns_validation_error_e2e_test.sh
    2400
  )
  deliveryoptimizer_add_docker_api_e2e_test(
    DeliveryOptimizerE2ETest.DeliveriesOptimizeMalformedJsonReturnsParseError
    deliveries_optimize_malformed_json_returns_parse_error_e2e_test.sh
    2400
  )
endif()
