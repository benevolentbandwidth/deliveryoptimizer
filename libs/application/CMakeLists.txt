add_library(deliveryoptimizer_application)
add_library(deliveryoptimizer::application ALIAS deliveryoptimizer_application)

target_sources(
  deliveryoptimizer_application
  PRIVATE
    src/optimize_service.cpp
  PUBLIC
    FILE_SET HEADERS
    BASE_DIRS include
    FILES
      include/deliveryoptimizer/application/optimize_service.hpp
)

target_include_directories(deliveryoptimizer_application PUBLIC include)
target_compile_features(deliveryoptimizer_application PUBLIC cxx_std_20)
target_link_libraries(deliveryoptimizer_application PUBLIC deliveryoptimizer::domain)

if(DELIVERYOPTIMIZER_ENABLE_WARNINGS)
  deliveryoptimizer_set_warnings(deliveryoptimizer_application)
endif()
