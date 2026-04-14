#!/usr/bin/env bash
# Usage: ./infra/scripts/prepare-osrm-data.sh <gcs-bucket> [prefix]
# Runs OSRM preprocessing locally and uploads processed .osrm files to GCS.
# Prerequisites: docker, gcloud CLI authenticated with storage write access.
set -euo pipefail

BUCKET="${1:?Usage: $0 <gcs-bucket> [prefix]}"
PREFIX="${2:-california}"
PBF_URL="https://download.geofabrik.de/north-america/us/california-latest.osm.pbf"
REGISTRY="us-east1-docker.pkg.dev/b2-delivery-optimizer/services"
DATA_DIR="$(mktemp -d)"
trap 'rm -rf "${DATA_DIR}"' EXIT

echo "==> Downloading PBF (~1.4 GB) from ${PBF_URL}"
curl -fL "${PBF_URL}" -o "${DATA_DIR}/${PREFIX}.osm.pbf"

echo "==> Running OSRM preprocessing (~20-40 min)"
docker run --rm \
  --entrypoint /bin/bash \
  -v "${DATA_DIR}:/data" \
  "${REGISTRY}/osrm:latest" \
  -c "
    osrm-extract -p /opt/osrm-backend/profiles/car.lua /data/${PREFIX}.osm.pbf
    osrm-partition /data/${PREFIX}.osrm
    osrm-customize /data/${PREFIX}.osrm
  "

echo "==> Uploading to gs://${BUCKET}/${PREFIX}/"
gcloud storage cp "${DATA_DIR}/${PREFIX}.osrm"* "gs://${BUCKET}/${PREFIX}/" \
  --impersonate-service-account=do-app-service@b2-delivery-optimizer.iam.gserviceaccount.com

echo "==> Done. Verify with: gcloud storage ls gs://${BUCKET}/${PREFIX}/"
