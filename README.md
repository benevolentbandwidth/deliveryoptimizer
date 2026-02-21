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

## Optimize Example

```bash
curl -sS -X POST http://localhost:5050/api/v1/deliveries/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "depot": { "location": [7.4236, 43.7384] },
    "vehicles": [
      { "id": "van-1", "capacity": 8 }
    ],
    "jobs": [
      { "id": "order-1", "location": [7.4212, 43.7308], "demand": 2, "service": 180 },
      { "id": "order-2", "location": [7.4261, 43.7412], "demand": 1, "service": 120 }
    ]
  }'
```

Example response (trimmed):

```json
{
  "status": "ok",
  "summary": {
    "routes": 1,
    "unassigned": 0
  },
  "routes": [
    {
      "vehicle": 1,
      "vehicle_external_id": "van-1",
      "steps": [
        { "type": "start" },
        { "type": "job", "job": 1, "job_external_id": "order-1" },
        { "type": "job", "job": 2, "job_external_id": "order-2" },
        { "type": "end" }
      ]
    }
  ],
  "unassigned": []
}
```

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
# Delivery Optimizer UI

Frontend application for optimizing delivery routes.

## Prerequisites

- Node.js 18+ or Bun
- Backend API running (see main repo README)

## Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local

Configure your backend API URL:
NEXT_PUBLIC_API_URL=http://localhost:5050

Development

npm install
npm run dev

Open http://localhost:3000

Project Structure

- src/app/ - Next.js App Router pages
- src/components/ - Reusable React components (coming soon)
- src/lib/ - Utilities and API clients (coming soon)

Connecting to Backend

The backend API (PR #27) must be running for full functionality.
See CLAUDE.md or main README for setup instructions.
