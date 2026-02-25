# ARM Deployment (HTTP Server)

This document describes the deployment assets for the C++ Drogon HTTP server (`deliveryoptimizer-api`) on ARM Linux (`linux/arm64`).

## Files

- `services/http-server.Dockerfile`: ARM-aware container build for the API.
- `compose/docker-compose.arm64.yml`: Compose service definition.
- `env/http-server.arm64.env`: Default ARM runtime/build settings.

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
