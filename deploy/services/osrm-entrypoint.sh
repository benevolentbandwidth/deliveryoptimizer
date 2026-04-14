#!/usr/bin/env bash
set -euo pipefail

data_dir="${OSRM_DATA_DIR:-/data}"
pbf_url="${OSRM_PBF_URL:-https://download.geofabrik.de/north-america/us/california-latest.osm.pbf}"
profile="${OSRM_PROFILE:-/opt/osrm-backend/profiles/car.lua}"
port="${OSRM_PORT:-5001}"

# GCS fast-boot path (Cloud Run): skip PBF download/processing
gcs_bucket="${OSRM_GCS_BUCKET:-}"
gcs_prefix="${OSRM_GCS_PREFIX:-california}"

if [[ -n "${gcs_bucket}" ]]; then
  echo "GCS mode: fetching pre-processed OSRM data from gs://${gcs_bucket}/${gcs_prefix}/"
  mkdir -p "${data_dir}"
  gcloud storage cp "gs://${gcs_bucket}/${gcs_prefix}/*.osrm*" "${data_dir}/"
  osrm_file="${data_dir}/${gcs_prefix}.osrm"
  echo "Starting OSRM on port ${port}"
  exec osrm-routed --algorithm mld --port "${port}" "${osrm_file}"
fi

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
