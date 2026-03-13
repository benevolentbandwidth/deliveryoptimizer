function(deliveryoptimizer_set_warnings target_name)
  if(NOT TARGET "${target_name}")
    message(FATAL_ERROR "deliveryoptimizer_set_warnings called for non-existent target: ${target_name}")
  endif()

  if(MSVC)
    target_compile_options("${target_name}" PRIVATE /W4 /WX /permissive-)
  else()
    target_compile_options(
      "${target_name}"
      PRIVATE
        -Wall
        -Wextra
        -Wpedantic
        -Wconversion
        -Wsign-conversion
        -Werror
    )
  endif()
endfunction()
