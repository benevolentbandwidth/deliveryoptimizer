# ARM Deployment (HTTP Server + Routing)

This document describes the deployment assets for the C++ Drogon HTTP server (`deliveryoptimizer-api`), OSRM, and VROOM on ARM Linux (`linux/arm64`).

## Files

- `deploy/services/http-server.Dockerfile`: ARM-aware container build for the API and VROOM binary.
- `deploy/services/osrm.Dockerfile`: ARM-aware container build for OSRM.
- `deploy/compose/docker-compose.arm64.yml`: Compose service definition (API + OSRM).
- `deploy/env/http-server.arm64.env`: Default ARM runtime/build settings, including California map source.

Port configuration defaults to `8080` for both the host mapping and the app listen port.
Use `DELIVERYOPTIMIZER_HOST_PORT` to change the host-facing port. If you need the API to bind a
different in-container port, update the container environment and the compose port mapping together.

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

OSRM check:

```bash
curl -f "http://localhost:5001/nearest/v1/driving/-122.4194,37.7749?number=1&generate_hints=false"
```

VROOM binary check:

```bash
docker compose \
  --env-file deploy/env/http-server.arm64.env \
  -f deploy/compose/docker-compose.arm64.yml \
  exec http-server vroom --help
```

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
