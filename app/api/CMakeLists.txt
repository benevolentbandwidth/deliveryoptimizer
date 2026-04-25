find_package(Drogon CONFIG REQUIRED)

add_library(deliveryoptimizer_api_runtime)
target_sources(
  deliveryoptimizer_api_runtime
  PRIVATE
    src/api_server.cpp
    src/endpoints/deliveries_optimize_endpoint.cpp
    src/endpoints/health_endpoint.cpp
    src/endpoints/metrics_endpoint.cpp
    src/endpoints/optimization_jobs_endpoint.cpp
    src/endpoints/optimize_endpoint.cpp
    src/endpoints/osrm_proxy_endpoint.cpp
    src/optimization_job_runtime.cpp
    src/optimization_job_store.cpp
    src/observability.cpp
    src/optimize_request.cpp
    src/request_context.cpp
    src/solve_admission.cpp
    src/solve_coordinator.cpp
    src/solve_execution.cpp
    src/server_options.cpp
    src/vroom_runner.cpp
  PUBLIC
    FILE_SET HEADERS
    BASE_DIRS include
    FILES
      include/deliveryoptimizer/api/api_server.hpp
      include/deliveryoptimizer/api/deliveries_optimize_limits.hpp
      include/deliveryoptimizer/api/endpoints/deliveries_optimize_endpoint.hpp
      include/deliveryoptimizer/api/endpoints/health_endpoint.hpp
      include/deliveryoptimizer/api/endpoints/metrics_endpoint.hpp
      include/deliveryoptimizer/api/endpoints/optimization_jobs_endpoint.hpp
      include/deliveryoptimizer/api/endpoints/optimize_endpoint.hpp
      include/deliveryoptimizer/api/endpoints/osrm_proxy_endpoint.hpp
      include/deliveryoptimizer/api/internal/json_utils.hpp
      include/deliveryoptimizer/api/optimization_job_runtime.hpp
      include/deliveryoptimizer/api/optimization_job_store.hpp
      include/deliveryoptimizer/api/observability.hpp
      include/deliveryoptimizer/api/optimize_request.hpp
      include/deliveryoptimizer/api/solve_admission.hpp
      include/deliveryoptimizer/api/solve_coordinator.hpp
      include/deliveryoptimizer/api/solve_execution.hpp
      include/deliveryoptimizer/api/server_options.hpp
      include/deliveryoptimizer/api/vroom_runner.hpp
)
target_include_directories(deliveryoptimizer_api_runtime PUBLIC include)
target_compile_features(deliveryoptimizer_api_runtime PUBLIC cxx_std_20)
target_link_libraries(
  deliveryoptimizer_api_runtime
  PUBLIC
    deliveryoptimizer::adapters
  PRIVATE
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
