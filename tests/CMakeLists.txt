find_package(GTest CONFIG REQUIRED)
include(GoogleTest)

add_executable(deliveryoptimizer_tests test_smoke.cpp)
target_compile_features(deliveryoptimizer_tests PRIVATE cxx_std_20)
target_link_libraries(
  deliveryoptimizer_tests
  PRIVATE
    deliveryoptimizer::adapters
    GTest::gtest_main
)

if(DELIVERYOPTIMIZER_ENABLE_WARNINGS)
  deliveryoptimizer_set_warnings(deliveryoptimizer_tests)
endif()

gtest_discover_tests(deliveryoptimizer_tests DISCOVERY_TIMEOUT 30)
