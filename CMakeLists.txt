cmake_minimum_required(VERSION 3.24)

project(deliveryoptimizer_routing LANGUAGES NONE)

set(ENV_FILE "${CMAKE_SOURCE_DIR}/infra/env/routing.env" CACHE FILEPATH "Environment file for docker compose")
set(COMPOSE_FILE "${CMAKE_SOURCE_DIR}/infra/compose/routing.compose.yml" CACHE FILEPATH "Compose file for routing stack")

find_program(BASH_EXECUTABLE bash REQUIRED)
find_program(DOCKER_EXECUTABLE docker REQUIRED)
find_program(CCACHE_EXECUTABLE ccache)

if(CCACHE_EXECUTABLE)
  message(STATUS "ccache detected at ${CCACHE_EXECUTABLE}")
else()
  message(STATUS "ccache not found in PATH; Docker builds will run without compiler launcher caching.")
endif()

set(COMPOSE_CMD "\"${DOCKER_EXECUTABLE}\" compose -f \"${COMPOSE_FILE}\" --env-file \"${ENV_FILE}\"")

function(add_shell_target target_name)
  cmake_parse_arguments(ARG "USES_ENV_FILE" "" "COMMANDS;DEPENDS" ${ARGN})

  if(NOT ARG_COMMANDS)
    message(FATAL_ERROR "Target '${target_name}' needs at least one command.")
  endif()

  set(target_commands "")
  foreach(raw_cmd IN LISTS ARG_COMMANDS)
    if(ARG_USES_ENV_FILE)
      list(APPEND target_commands
        COMMAND "${BASH_EXECUTABLE}" "-lc"
          "set -a && source \"${ENV_FILE}\" && set +a && ${raw_cmd}"
      )
    else()
      list(APPEND target_commands
        COMMAND "${BASH_EXECUTABLE}" "-lc" "${raw_cmd}"
      )
    endif()
  endforeach()

  add_custom_target(${target_name}
    ${target_commands}
    WORKING_DIRECTORY "${CMAKE_SOURCE_DIR}"
    USES_TERMINAL
    VERBATIM
  )

  if(ARG_DEPENDS)
    add_dependencies(${target_name} ${ARG_DEPENDS})
  endif()
endfunction()

add_shell_target(
  build
  COMMANDS
    "${COMPOSE_CMD} build osrm"
    "${COMPOSE_CMD} build deliveryoptimizer-api"
)

add_shell_target(
  up
  COMMANDS
    "${COMPOSE_CMD} up -d"
)

add_shell_target(
  down
  COMMANDS
    "${COMPOSE_CMD} down"
)

add_shell_target(
  smoke
  USES_ENV_FILE
  COMMANDS
    "BASE_URL=\"http://localhost:$OSRM_PUBLIC_PORT\" && curl -fsS \"$BASE_URL/health\" >/dev/null && echo \"smoke checks passed\""
)

add_shell_target(
  logs
  COMMANDS
    "${COMPOSE_CMD} logs -f --tail=200"
)
