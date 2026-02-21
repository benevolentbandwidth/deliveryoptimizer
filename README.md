# Delivery Optimizer

A small-business delivery route optimizer built on a source-compiled OSRM/VROOM routing stack with a Next.js frontend.

---

## Backend — Routing Stack

Provisions a source-built routing stack:

- OSRM compiled from source
- VROOM compiled from source
- One public HTTP server at `localhost:5050` for health, optimization, and OSRM proxy access

### Structure

- `engine/osrm` — OSRM build/runtime image
- `services/deliveryoptimizer-api` — Python HTTP router + VROOM build image
- `infra/compose` — Docker Compose definitions
- `infra/env` — Runtime/build environment variables

### API Endpoints

- `GET /health` — readiness (`200` only if OSRM + VROOM are ready)
- `POST /api/v1/deliveries/optimize` — optimize multi-stop delivery routes
- `GET /api/v1/osrm/*` — proxy OSRM API requests (e.g., `route`, `nearest`, `table`)

### Run (CMake)

1. `cmake --preset dev`
2. `cmake --build --preset dev --target build`
3. `cmake --build --preset dev --target up`
4. `cmake --build --preset dev --target smoke` (runs HTTP health check)

`ccache` is used for C++ compilation inside Docker build stages.

If your machine is memory constrained, reduce parallel compile jobs in `infra/env/routing.env`:

- `OSRM_BUILD_JOBS=1`
- `VROOM_BUILD_JOBS=1`

Default dev map data is `monaco-latest.osm.pbf` for fast startup. Set `OSRM_PBF_URL` in `infra/env/routing.env` for your target delivery region.

### Acceptance Check

```bash
curl -f http://localhost:5050/health
```

Expected: HTTP `200` and JSON with `"status":"ok"`.

If port `5000` is free and you want that exact endpoint, set `OSRM_PUBLIC_PORT=5000` in `infra/env/routing.env`.

---

## Frontend — UI

Next.js frontend for interacting with the routing stack.

### Prerequisites

- Node.js 18+ or Bun
- Backend stack running (see above)

### Environment Setup

```bash
cp .env.example .env.local
```

Set your backend URL in `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:5050
```

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Project Structure

- `src/app/` — Next.js App Router pages
- `src/components/` — Reusable React components
- `src/lib/` — Utilities and API clients
