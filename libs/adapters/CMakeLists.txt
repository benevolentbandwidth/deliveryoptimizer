find_package(jsoncpp CONFIG REQUIRED)

add_library(deliveryoptimizer_adapters)
add_library(deliveryoptimizer::adapters ALIAS deliveryoptimizer_adapters)

target_sources(
  deliveryoptimizer_adapters
  PRIVATE
    src/osrm_contract.cpp
    src/routing_facade.cpp
    src/vroom_contract.cpp
  PUBLIC
    FILE_SET HEADERS
    BASE_DIRS include
    FILES
      include/deliveryoptimizer/adapters/osrm_contract.hpp
      include/deliveryoptimizer/adapters/routing_facade.hpp
      include/deliveryoptimizer/adapters/vroom_contract.hpp
)

target_include_directories(deliveryoptimizer_adapters PUBLIC include)
target_compile_features(deliveryoptimizer_adapters PUBLIC cxx_std_20)
target_link_libraries(
  deliveryoptimizer_adapters
  PUBLIC
    deliveryoptimizer::application
  PRIVATE
    JsonCpp::JsonCpp
)

if(DELIVERYOPTIMIZER_ENABLE_WARNINGS)
  deliveryoptimizer_set_warnings(deliveryoptimizer_adapters)
endif()
