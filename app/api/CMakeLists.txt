find_package(Drogon CONFIG REQUIRED)

add_executable(deliveryoptimizer_api src/main.cpp)
target_compile_features(deliveryoptimizer_api PRIVATE cxx_std_20)
target_link_libraries(
  deliveryoptimizer_api
  PRIVATE
    deliveryoptimizer::adapters
    Drogon::Drogon
)

if(DELIVERYOPTIMIZER_ENABLE_WARNINGS)
  deliveryoptimizer_set_warnings(deliveryoptimizer_api)
endif()

set_target_properties(deliveryoptimizer_api PROPERTIES OUTPUT_NAME deliveryoptimizer-api)
