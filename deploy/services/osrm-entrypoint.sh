#!/usr/bin/env bash
set -euo pipefail

data_dir="${OSRM_DATA_DIR:-/data}"
pbf_url="${OSRM_PBF_URL:-https://download.geofabrik.de/north-america/us/california-latest.osm.pbf}"
profile="${OSRM_PROFILE:-/opt/osrm-backend/profiles/car.lua}"
port="${OSRM_PORT:-5001}"

mkdir -p "${data_dir}"

pbf_file_name="${OSRM_PBF_FILE:-${pbf_url##*/}}"
pbf_path="${data_dir}/${pbf_file_name}"

if [[ ! -f "${pbf_path}" ]]; then
  echo "Downloading map data from ${pbf_url}"
  curl -fL "${pbf_url}" -o "${pbf_path}"
fi

if [[ "${pbf_path}" == *.osm.pbf ]]; then
  osrm_base="${pbf_path%.osm.pbf}"
elif [[ "${pbf_path}" == *.pbf ]]; then
  osrm_base="${pbf_path%.pbf}"
else
  echo "Expected a .pbf or .osm.pbf file, got ${pbf_path}"
  exit 1
fi

osrm_file="${osrm_base}.osrm"

if [[ ! -f "${osrm_file}" ]]; then
  echo "Preparing OSRM data files using profile ${profile}"
  osrm-extract -p "${profile}" "${pbf_path}"
  osrm-partition "${osrm_file}"
  osrm-customize "${osrm_file}"
fi

echo "Starting OSRM on port ${port}"
exec osrm-routed --algorithm mld --port "${port}" "${osrm_file}"
