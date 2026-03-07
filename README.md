# Delivery Optimizer

This branch bootstraps the C++ backend scaffold (Conan + CMake + Drogon) and keeps the Next.js UI in `app/ui`.

## Contributor Docs

- C++ local environment setup: `docs/cpp-local-contributor-setup.md`
- ARM deployment assets: `docs/http-server-arm-deployment.md`

## Repository Layout

- `app/api`: C++ HTTP server entrypoint.
- `libs`: domain/application/adapter libraries.
- `deploy`: deployment assets for ARM image builds and compose.
- `tests`: C++ and integration tests.
- `app/ui`: Next.js frontend.

## API (Bootstrap Stage)

- `GET /health`
- `GET /optimize?deliveries=<n>&vehicles=<n>`

Example:

```bash
curl -fsS "http://127.0.0.1:8080/optimize?deliveries=4&vehicles=2"
```

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

## UI

- Node.js `>=20.9.0`

```bash
npm --prefix app/ui install
npm --prefix app/ui run dev
```

Open `http://localhost:3000`.
