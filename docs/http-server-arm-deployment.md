# ARM Deployment (HTTP Server + Routing)

This document describes the deployment assets for the C++ Drogon HTTP server (`deliveryoptimizer-api`), PostgreSQL, OSRM, and VROOM on ARM Linux (`linux/arm64`).

## Files

- `deploy/services/http-server.Dockerfile`: ARM-aware container build for the API and VROOM binary.
- `deploy/services/osrm.Dockerfile`: ARM-aware container build for OSRM.
- `deploy/compose/docker-compose.arm64.yml`: Compose service definition (API + PostgreSQL + OSRM).
- `deploy/env/http-server.arm64.env`: Default ARM runtime/build settings, including California map source and async job database settings.

Port configuration defaults to `8080` for both the host mapping and the app listen port.
Use `DELIVERYOPTIMIZER_HOST_PORT` to change the host-facing port. If you need the API to bind a
different in-container port, update the container environment and the compose port mapping together.

Prometheus metrics stay disabled by default. If you enable `DELIVERYOPTIMIZER_ENABLE_METRICS=1`,
the `/metrics` endpoint shares the same listener as the solve API, so only expose that port to
trusted internal scrapers. `POST /api/v1/deliveries/optimize` is also disabled by default; the
supported public submission path is `POST /api/v1/optimization-jobs`.

## Run on ARM host

From the repository root:

```bash
docker compose \
  --env-file deploy/env/http-server.arm64.env \
  -f deploy/compose/docker-compose.arm64.yml \
  up --build -d
```

Health check:

```bash
curl -f http://localhost:8080/health
```

Async job submission check:

```bash
curl -X POST http://localhost:8080/api/v1/optimization-jobs \
  -H 'Content-Type: application/json' \
  --data-binary '{"depot":{"location":[7.4236,43.7384]},"vehicles":[{"id":"van-1","capacity":8}],"jobs":[{"id":"order-1","location":[7.4212,43.7308],"demand":1}]}'
```

VROOM binary check:

```bash
docker compose \
  --env-file deploy/env/http-server.arm64.env \
  -f deploy/compose/docker-compose.arm64.yml \
  exec http-server vroom --help
```

Internal OSRM check:

```bash
docker compose --env-file deploy/env/http-server.arm64.env -f deploy/compose/docker-compose.arm64.yml \
  exec osrm sh -c 'curl -f "http://127.0.0.1:${OSRM_PORT:-5001}/nearest/v1/driving/-122.4194,37.7749?number=1&generate_hints=false"'
```

PostgreSQL stays internal to the compose network. The API reaches it through
`DELIVERYOPTIMIZER_PG_DSN`; there is no default host port published for the database.

## Build ARM image from non-ARM host

Use `buildx` with emulation:

```bash
docker buildx build \
  --platform linux/arm64 \
  -f deploy/services/http-server.Dockerfile \
  -t deliveryoptimizer-http:arm64 \
  .
```

Add `--push` to publish to a registry.
