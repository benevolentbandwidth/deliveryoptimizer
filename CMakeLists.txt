cmake_minimum_required(VERSION 3.25)

project(deliveryoptimizer VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(DELIVERYOPTIMIZER_ENABLE_WARNINGS "Enable strict compiler warnings." ON)
option(DELIVERYOPTIMIZER_ENABLE_TESTS "Build unit tests." ON)
option(DELIVERYOPTIMIZER_ENABLE_SANITIZERS "Enable sanitizer instrumentation for Debug builds." OFF)
set(
  DELIVERYOPTIMIZER_SANITIZERS
  "address;undefined"
  CACHE STRING
  "Semicolon- or comma-separated sanitizer list enabled when DELIVERYOPTIMIZER_ENABLE_SANITIZERS is ON."
)

list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")
include(CompilerWarnings)
include(Sanitizers)
deliveryoptimizer_enable_sanitizers()

if(CMAKE_EXPORT_COMPILE_COMMANDS AND NOT CMAKE_SOURCE_DIR STREQUAL CMAKE_BINARY_DIR)
  execute_process(COMMAND "${CMAKE_COMMAND}" -E rm -f "${CMAKE_SOURCE_DIR}/compile_commands.json")
  execute_process(
    COMMAND "${CMAKE_COMMAND}" -E create_symlink
            "${CMAKE_BINARY_DIR}/compile_commands.json"
            "${CMAKE_SOURCE_DIR}/compile_commands.json"
  )
endif()

add_subdirectory(libs/domain)
add_subdirectory(libs/application)
add_subdirectory(libs/adapters)
add_subdirectory(app/api)

if(DELIVERYOPTIMIZER_ENABLE_TESTS)
  include(CTest)
  if(BUILD_TESTING)
    add_subdirectory(tests)
  endif()
endif()
