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
    RESULT_VARIABLE create_compile_commands_symlink_result
    ERROR_VARIABLE create_compile_commands_symlink_error
  )
  if(NOT create_compile_commands_symlink_result EQUAL 0)
    message(
      WARNING
      "Failed to create compile_commands.json symlink: ${create_compile_commands_symlink_error}. "
      "Falling back to a build-time copy."
    )
    set(deliveryoptimizer_copy_compile_commands_script
        "${CMAKE_BINARY_DIR}/copy_compile_commands.cmake")
    file(
      WRITE "${deliveryoptimizer_copy_compile_commands_script}"
      "if(EXISTS \"${CMAKE_BINARY_DIR}/compile_commands.json\")\n"
      "  execute_process(\n"
      "    COMMAND \"${CMAKE_COMMAND}\" -E copy_if_different\n"
      "            \"${CMAKE_BINARY_DIR}/compile_commands.json\"\n"
      "            \"${CMAKE_SOURCE_DIR}/compile_commands.json\"\n"
      "    RESULT_VARIABLE copy_compile_commands_result\n"
      "  )\n"
      "  if(NOT copy_compile_commands_result EQUAL 0)\n"
      "    message(FATAL_ERROR \"Failed to copy compile_commands.json to source directory.\")\n"
      "  endif()\n"
      "endif()\n"
    )
    add_custom_target(
      copy_compile_commands ALL
      COMMAND "${CMAKE_COMMAND}" -P "${deliveryoptimizer_copy_compile_commands_script}"
      COMMENT "Copying compile_commands.json to source directory"
      VERBATIM
    )
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
