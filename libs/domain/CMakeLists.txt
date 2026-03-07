add_library(deliveryoptimizer_domain)
add_library(deliveryoptimizer::domain ALIAS deliveryoptimizer_domain)

target_sources(
  deliveryoptimizer_domain
  PRIVATE
    src/problem.cpp
  PUBLIC
    FILE_SET HEADERS
    BASE_DIRS include
    FILES
      include/deliveryoptimizer/domain/problem.hpp
)

target_include_directories(deliveryoptimizer_domain PUBLIC include)
target_compile_features(deliveryoptimizer_domain PUBLIC cxx_std_20)

if(DELIVERYOPTIMIZER_ENABLE_WARNINGS)
  deliveryoptimizer_set_warnings(deliveryoptimizer_domain)
endif()
