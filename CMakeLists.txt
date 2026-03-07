cmake_minimum_required(VERSION 3.25)

project(deliveryoptimizer VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(DELIVERYOPTIMIZER_ENABLE_WARNINGS "Enable strict compiler warnings." ON)
option(DELIVERYOPTIMIZER_ENABLE_TESTS "Build unit tests." ON)
option(DELIVERYOPTIMIZER_ENABLE_SANITIZERS "Enable sanitizer instrumentation for Debug builds." OFF)
option(
  DELIVERYOPTIMIZER_LINK_COMPILE_COMMANDS_IN_SOURCE
  "Create a source-tree compile_commands.json symlink for editor tooling."
  OFF
)
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

if(DELIVERYOPTIMIZER_LINK_COMPILE_COMMANDS_IN_SOURCE)
  if(NOT CMAKE_EXPORT_COMPILE_COMMANDS)
    message(
      WARNING
      "DELIVERYOPTIMIZER_LINK_COMPILE_COMMANDS_IN_SOURCE is ON but CMAKE_EXPORT_COMPILE_COMMANDS is OFF."
    )
  elseif(CMAKE_SOURCE_DIR STREQUAL CMAKE_BINARY_DIR)
    message(STATUS "In-source build already writes compile_commands.json in the source tree.")
  else()
    set(DELIVERYOPTIMIZER_SOURCE_COMPILE_COMMANDS "${CMAKE_SOURCE_DIR}/compile_commands.json")
    set(DELIVERYOPTIMIZER_BUILD_COMPILE_COMMANDS "${CMAKE_BINARY_DIR}/compile_commands.json")

    execute_process(
      COMMAND "${CMAKE_COMMAND}" -E rm -f "${DELIVERYOPTIMIZER_SOURCE_COMPILE_COMMANDS}"
      RESULT_VARIABLE remove_compile_commands_result
      ERROR_VARIABLE remove_compile_commands_error
    )
    if(NOT remove_compile_commands_result EQUAL 0)
      message(
        WARNING
        "Failed to remove ${DELIVERYOPTIMIZER_SOURCE_COMPILE_COMMANDS}: "
        "${remove_compile_commands_error}. Skipping source-tree compile_commands.json link creation."
      )
    else()
      execute_process(
        COMMAND "${CMAKE_COMMAND}" -E create_symlink
                "${DELIVERYOPTIMIZER_BUILD_COMPILE_COMMANDS}"
                "${DELIVERYOPTIMIZER_SOURCE_COMPILE_COMMANDS}"
        RESULT_VARIABLE create_compile_commands_symlink_result
        ERROR_VARIABLE create_compile_commands_symlink_error
      )
      if(NOT create_compile_commands_symlink_result EQUAL 0)
        message(
          WARNING
          "Failed to create compile_commands.json symlink in source tree: "
          "${create_compile_commands_symlink_error}. Use ${DELIVERYOPTIMIZER_BUILD_COMPILE_COMMANDS} directly."
        )
      endif()
    endif()
  endif()
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
