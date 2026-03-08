# Delivery Optimizer

This branch introduces the C++ API runtime modules plus ARM routing stack assets (OSRM + VROOM) and an OSRM proxy endpoint.

## Contributor Docs

- C++ local environment setup: `docs/cpp-local-contributor-setup.md`
- ARM deployment assets: `docs/http-server-arm-deployment.md`

## Repository Layout

- `app/api`: C++ HTTP server entrypoint and endpoint modules.
- `libs`: domain/application/adapter libraries.
- `deploy`: Dockerfiles, compose files, and env files.
- `tests`: C++ tests, local HTTP integration tests, and routing smoke tests.
- `app/ui`: Next.js frontend.

## API Endpoints

- `GET /health`
- `GET /optimize?deliveries=<n>&vehicles=<n>`
- `POST /api/v1/deliveries/optimize`
- `GET /api/v1/osrm/*` (allowlisted OSRM services)

Example:

```bash
curl -X POST http://127.0.0.1:8080/api/v1/deliveries/optimize \
  -H 'Content-Type: application/json' \
  --data-binary '{
    "depot": { "location": [-122.4194, 37.7749] },
    "vehicles": [{ "id": "van-1", "capacity": 8 }],
    "jobs": [{ "id": "order-1", "location": [-122.4183, 37.7758], "demand": 1 }]
  }'
```

If `jobs[].demand` is omitted, the API defaults it to `1`. If `jobs[].service` is omitted, the API defaults it to `300` seconds.

## Build (C++)

```bash
conan profile detect --force
conan install . --output-folder=build --build=missing -s build_type=Release
cmake -S . -B build/build/Release \
  -DCMAKE_TOOLCHAIN_FILE=build/build/Release/generators/conan_toolchain.cmake \
  -DCMAKE_BUILD_TYPE=Release
cmake --build build/build/Release
ctest --test-dir build/build/Release --output-on-failure
```

Run:

```bash
./build/build/Release/app/api/deliveryoptimizer-api
```

## Routing Stack (Docker)

```bash
docker compose \
  --env-file deploy/env/http-server.arm64.env \
  -f deploy/compose/docker-compose.arm64.yml \
  up --build -d
```

Quick checks:

```bash
curl -f http://127.0.0.1:8080/health
curl -f "http://127.0.0.1:5001/nearest/v1/driving/-122.4194,37.7749?number=1&generate_hints=false"
```

## UI

- Node.js `>=20.9.0`

```bash
npm --prefix app/ui install
npm --prefix app/ui run dev
```

Open `http://localhost:3000`.
