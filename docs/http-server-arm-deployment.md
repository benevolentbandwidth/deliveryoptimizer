# ARM Deployment (HTTP Server)

This document describes the deployment assets for the C++ Drogon HTTP server (`deliveryoptimizer-api`) on ARM Linux (`linux/arm64`).

## Files

- `deploy/services/http-server.Dockerfile`: ARM-aware container build for the API.
- `deploy/compose/docker-compose.arm64.yml`: Compose service definition.
- `deploy/env/http-server.arm64.env`: Default ARM runtime/build settings.

Port configuration defaults to `8080` for both the host mapping and the app listen port.
Use `DELIVERYOPTIMIZER_HOST_PORT` to change the host-facing port and `DELIVERYOPTIMIZER_PORT` to
change the port the API binds inside the container.

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
