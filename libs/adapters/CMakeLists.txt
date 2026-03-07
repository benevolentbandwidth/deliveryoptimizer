add_library(deliveryoptimizer_adapters)
add_library(deliveryoptimizer::adapters ALIAS deliveryoptimizer_adapters)

target_sources(
  deliveryoptimizer_adapters
  PRIVATE
    src/routing_facade.cpp
  PUBLIC
    FILE_SET HEADERS
    BASE_DIRS include
    FILES
      include/deliveryoptimizer/adapters/routing_facade.hpp
)

target_include_directories(deliveryoptimizer_adapters PUBLIC include)
target_compile_features(deliveryoptimizer_adapters PUBLIC cxx_std_20)
target_link_libraries(deliveryoptimizer_adapters PUBLIC deliveryoptimizer::application)

if(DELIVERYOPTIMIZER_ENABLE_WARNINGS)
  deliveryoptimizer_set_warnings(deliveryoptimizer_adapters)
endif()
