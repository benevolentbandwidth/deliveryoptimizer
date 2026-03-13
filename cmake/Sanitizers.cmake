function(deliveryoptimizer_enable_sanitizers)
  if(NOT DELIVERYOPTIMIZER_ENABLE_SANITIZERS)
    return()
  endif()

  if(MSVC)
    message(FATAL_ERROR "Sanitizers are not configured for MSVC in this repository.")
  endif()

  if(NOT CMAKE_CXX_COMPILER_ID MATCHES "AppleClang|Clang|GNU")
    message(FATAL_ERROR "Unsupported compiler for sanitizers: ${CMAKE_CXX_COMPILER_ID}")
  endif()

  set(_sanitizers "${DELIVERYOPTIMIZER_SANITIZERS}")
  string(REPLACE "," ";" _sanitizers "${_sanitizers}")
  list(FILTER _sanitizers EXCLUDE REGEX "^$")
  if(NOT _sanitizers)
    message(FATAL_ERROR "DELIVERYOPTIMIZER_SANITIZERS is empty. Example: address;undefined")
  endif()

  string(JOIN "," _sanitizer_csv ${_sanitizers})
  set(_sanitize_flag "-fsanitize=${_sanitizer_csv}")

  add_compile_options(
    $<$<CONFIG:Debug>:${_sanitize_flag}>
    $<$<CONFIG:Debug>:-fno-omit-frame-pointer>
    $<$<CONFIG:Debug>:-fno-optimize-sibling-calls>
  )
  add_link_options($<$<CONFIG:Debug>:${_sanitize_flag}>)

  if(CMAKE_CONFIGURATION_TYPES)
    message(STATUS "Sanitizers enabled for Debug with: ${_sanitizer_csv}")
  elseif(NOT CMAKE_BUILD_TYPE STREQUAL "Debug")
    message(
      WARNING
        "DELIVERYOPTIMIZER_ENABLE_SANITIZERS is ON, but CMAKE_BUILD_TYPE='${CMAKE_BUILD_TYPE}'. "
        "Sanitizer flags are applied only to Debug."
    )
  endif()
endfunction()
