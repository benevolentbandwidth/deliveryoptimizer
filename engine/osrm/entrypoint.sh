#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${OSRM_DATA_DIR:-/data}"
PBF_URL="${OSRM_PBF_URL:-https://download.geofabrik.de/europe/monaco-latest.osm.pbf}"
PROFILE="${OSRM_PROFILE:-/opt/osrm-backend/profiles/car.lua}"
PORT="${OSRM_PORT:-5001}"

mkdir -p "${DATA_DIR}"

PBF_FILE_NAME="${OSRM_PBF_FILE:-${PBF_URL##*/}}"
PBF_PATH="${DATA_DIR}/${PBF_FILE_NAME}"

if [[ ! -f "${PBF_PATH}" ]]; then
  echo "Downloading map data from ${PBF_URL}"
  curl -fL "${PBF_URL}" -o "${PBF_PATH}"
fi

if [[ "${PBF_PATH}" == *.osm.pbf ]]; then
  OSRM_BASE="${PBF_PATH%.osm.pbf}"
elif [[ "${PBF_PATH}" == *.pbf ]]; then
  OSRM_BASE="${PBF_PATH%.pbf}"
else
  echo "Expected a .pbf or .osm.pbf file, got ${PBF_PATH}"
  exit 1
fi

OSRM_FILE="${OSRM_BASE}.osrm"

if [[ ! -f "${OSRM_FILE}" ]]; then
  echo "Preparing OSRM data files using profile ${PROFILE}"
  osrm-extract -p "${PROFILE}" "${PBF_PATH}"
  osrm-partition "${OSRM_FILE}"
  osrm-customize "${OSRM_FILE}"
fi

echo "Starting OSRM on port ${PORT}"
exec osrm-routed --algorithm mld --port "${PORT}" "${OSRM_FILE}"
