# Delivery Optimizer Routing Stack

This repository provisions a source-built routing stack for small-business delivery optimization:

- OSRM compiled from source
- VROOM compiled from source
- One public HTTP server at `localhost:5050` for health, optimization, and OSRM proxy access

## Structure

- `engine/osrm`: OSRM build/runtime image
- `services/deliveryoptimizer-api`: Python HTTP router + VROOM build image
- `infra/compose`: Docker Compose definitions
- `infra/env`: Runtime/build environment variables

## API Endpoints

- `GET /health`: readiness (`200` only if OSRM + VROOM are ready)
- `POST /api/v1/deliveries/optimize`: optimize multi-stop delivery routes
- `GET /api/v1/osrm/*`: proxy OSRM API requests (e.g., `route`, `nearest`, `table`)

## Run (CMake)

1. `cmake --preset dev`
2. `cmake --build --preset dev --target build`
3. `cmake --build --preset dev --target up`
4. `cmake --build --preset dev --target smoke` (runs HTTP health check)

`ccache` is used for C++ engine compilation inside Docker build stages. The local CMake preset also defaults `CCACHE_DIR` to `.ccache` at the repository root.

If your machine is memory constrained, reduce parallel compile jobs in `infra/env/routing.env`:

- `OSRM_BUILD_JOBS=1`
- `VROOM_BUILD_JOBS=1`

Default dev map data is `monaco-latest.osm.pbf` for fast startup. Set `OSRM_PBF_URL` in `infra/env/routing.env` for your target delivery region.

## Acceptance Check

When the stack is running:

```bash
curl -f http://localhost:5050/health
```

Expected: HTTP `200` and JSON with `"status":"ok"`.

If port `5000` is free on your machine and you want that exact endpoint, set `OSRM_PUBLIC_PORT=5000` in `infra/env/routing.env`.
