find_package(Drogon CONFIG REQUIRED)

add_library(deliveryoptimizer_api_runtime)
target_sources(
  deliveryoptimizer_api_runtime
  PRIVATE
    src/api_server.cpp
    src/endpoints/health_endpoint.cpp
    src/endpoints/optimize_endpoint.cpp
    src/server_options.cpp
  PUBLIC
    FILE_SET HEADERS
    BASE_DIRS include
    FILES
      include/deliveryoptimizer/api/api_server.hpp
      include/deliveryoptimizer/api/endpoints/health_endpoint.hpp
      include/deliveryoptimizer/api/endpoints/optimize_endpoint.hpp
      include/deliveryoptimizer/api/server_options.hpp
)
target_include_directories(deliveryoptimizer_api_runtime PUBLIC include)
target_compile_features(deliveryoptimizer_api_runtime PUBLIC cxx_std_20)
target_link_libraries(
  deliveryoptimizer_api_runtime
  PUBLIC
    deliveryoptimizer::adapters
    Drogon::Drogon
)

if(DELIVERYOPTIMIZER_ENABLE_WARNINGS)
  deliveryoptimizer_set_warnings(deliveryoptimizer_api_runtime)
endif()

add_executable(deliveryoptimizer_api src/main.cpp)
target_compile_features(deliveryoptimizer_api PRIVATE cxx_std_20)
target_link_libraries(deliveryoptimizer_api PRIVATE deliveryoptimizer_api_runtime)

if(DELIVERYOPTIMIZER_ENABLE_WARNINGS)
  deliveryoptimizer_set_warnings(deliveryoptimizer_api)
endif()

set_target_properties(deliveryoptimizer_api PROPERTIES OUTPUT_NAME deliveryoptimizer-api)
