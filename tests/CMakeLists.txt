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

gtest_discover_tests(deliveryoptimizer_tests DISCOVERY_TIMEOUT 30)

find_program(BASH_PROGRAM bash REQUIRED)
find_program(CURL_PROGRAM curl REQUIRED)
find_program(PYTHON3_PROGRAM python3 REQUIRED)
find_program(DOCKER_PROGRAM docker)

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

add_test(
  NAME DeliveryOptimizerApiTest.HealthAndOptimize
  COMMAND "${BASH_PROGRAM}" "${CMAKE_CURRENT_SOURCE_DIR}/integration/http_server/health_and_optimize_test.sh"
          "$<TARGET_FILE:deliveryoptimizer_api>" "${CURL_PROGRAM}"
)
set_tests_properties(DeliveryOptimizerApiTest.HealthAndOptimize PROPERTIES TIMEOUT 30)
deliveryoptimizer_set_local_http_test_port(DeliveryOptimizerApiTest.HealthAndOptimize 20000)

add_test(
  NAME DeliveryOptimizerApiValidationTest.OptimizeRejectsNegativeDeliveries
  COMMAND "${BASH_PROGRAM}"
          "${CMAKE_CURRENT_SOURCE_DIR}/integration/http_server/optimize_rejects_negative_deliveries_test.sh"
          "$<TARGET_FILE:deliveryoptimizer_api>" "${CURL_PROGRAM}"
)
set_tests_properties(DeliveryOptimizerApiValidationTest.OptimizeRejectsNegativeDeliveries PROPERTIES TIMEOUT 30)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiValidationTest.OptimizeRejectsNegativeDeliveries
  21000
)

add_test(
  NAME DeliveryOptimizerApiValidationTest.OptimizeRejectsExcessiveDeliveries
  COMMAND "${BASH_PROGRAM}"
          "${CMAKE_CURRENT_SOURCE_DIR}/integration/http_server/optimize_rejects_excessive_deliveries_test.sh"
          "$<TARGET_FILE:deliveryoptimizer_api>" "${CURL_PROGRAM}"
)
set_tests_properties(DeliveryOptimizerApiValidationTest.OptimizeRejectsExcessiveDeliveries PROPERTIES TIMEOUT 30)
deliveryoptimizer_set_local_http_test_port(
  DeliveryOptimizerApiValidationTest.OptimizeRejectsExcessiveDeliveries
  22000
)

add_test(
  NAME DeliveryOptimizerApiValidationTest.OptimizeRejectsMalformedDeliveries
  COMMAND "${BASH_PROGRAM}"
          "${CMAKE_CURRENT_SOURCE_DIR}/integration/http_server/optimize_rejects_malformed_deliveries_test.sh"
          "$<TARGET_FILE:deliveryoptimizer_api>" "${CURL_PROGRAM}"
)
set_tests_properties(DeliveryOptimizerApiValidationTest.OptimizeRejectsMalformedDeliveries PROPERTIES TIMEOUT 30)
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
)

add_test(
  NAME DeliveryOptimizerOsrmProxyTest.RejectsDisallowedService
  COMMAND "${BASH_PROGRAM}"
          "${CMAKE_CURRENT_SOURCE_DIR}/integration/http_server/osrm_proxy_rejects_disallowed_service_test.sh"
          "$<TARGET_FILE:deliveryoptimizer_api>" "${CURL_PROGRAM}"
)
set_tests_properties(DeliveryOptimizerOsrmProxyTest.RejectsDisallowedService PROPERTIES TIMEOUT 30)
deliveryoptimizer_set_local_http_test_port(DeliveryOptimizerOsrmProxyTest.RejectsDisallowedService 34000)

add_test(
  NAME DeliveryOptimizerOsrmProxyTest.RejectsTripService
  COMMAND "${BASH_PROGRAM}"
          "${CMAKE_CURRENT_SOURCE_DIR}/integration/http_server/osrm_proxy_rejects_trip_service_test.sh"
          "$<TARGET_FILE:deliveryoptimizer_api>" "${CURL_PROGRAM}"
)
set_tests_properties(DeliveryOptimizerOsrmProxyTest.RejectsTripService PROPERTIES TIMEOUT 30)

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
)
deliveryoptimizer_set_local_http_test_environment(
  DeliveryOptimizerOsrmProxyTest.ForwardsAllowedServiceWithQueryString
  "DELIVERYOPTIMIZER_TEST_PORT=36000;DELIVERYOPTIMIZER_OSRM_STUB_PORT=52000"
)

if(DOCKER_PROGRAM)
  add_test(
    NAME DeliveryOptimizerRoutingSmokeTest.OsrmAndVroom
    COMMAND
      "${BASH_PROGRAM}" "${CMAKE_CURRENT_SOURCE_DIR}/integration/routing/osrm_and_vroom_smoketest.sh"
      "${CMAKE_SOURCE_DIR}/tests/integration/routing/routing_smoketest.env"
      "${CMAKE_SOURCE_DIR}/deploy/compose/docker-compose.arm64.yml"
      "${DOCKER_PROGRAM}" "${CURL_PROGRAM}"
  )
  set_tests_properties(
    DeliveryOptimizerRoutingSmokeTest.OsrmAndVroom
    PROPERTIES
      DISABLED TRUE
      RUN_SERIAL TRUE
      TIMEOUT 1800
  )
endif()
