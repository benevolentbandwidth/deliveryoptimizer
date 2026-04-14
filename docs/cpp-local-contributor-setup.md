# C++ Local Contributor Setup

This guide covers local setup for contributing to the C++ code in this repository.

## Stack

- C++20
- CMake (3.25+)
- Conan 2.x (dependency management)
- Drogon (HTTP framework)
- GTest (test framework)

## 1) Install required tools

Required tools:

- `cmake`
- `conan` (v2+)
- C++ compiler toolchain (`clang++` or `g++`)
- `clang-format`
- `clang-tidy`
- `clangd`
- `ninja` (optional, Makefiles also work)

If you want a consistent LLVM toolchain for build + lint on macOS or Linux, prefer the repo flake:

```bash
nix develop
```

Requires flakes enabled and Nix `>= 2.19`, because this repo's `flake.lock` uses format version `7`.

The flake shell includes:

- `clang`, `clangd`, `clang-format`, `clang-tidy`
- `cmake`, `conan`, `ninja`, `ccache`, `pkg-config`
- `python3`
- Docker and PostgreSQL tooling for the backend/e2e stack

The flake shell is intentionally backend-only. Frontend Node tooling stays outside this shell.

If you only need a temporary shell, you can still use:

```bash
nix shell \
  nixpkgs#cmake \
  nixpkgs#conan \
  nixpkgs#clang-tools \
  nixpkgs#ninja
```

## 2) Detect Conan profile

Run once on a machine (or again after toolchain changes):

```bash
conan profile detect --force
```

## 3) Install dependencies (Release)

From repo root:

```bash
conan install . \
  --output-folder=build \
  --build=missing \
  -s build_type=Release
```

This generates Conan toolchain/dependency files and the CMake preset consumed by `CMakeUserPresets.json`.

## 4) Configure + build

```bash
cmake --preset conan-release
cmake --build --preset conan-release -j"$(getconf _NPROCESSORS_ONLN 2>/dev/null || sysctl -n hw.ncpu)"
```

The API binary will be at:

`build/build/Release/app/api/deliveryoptimizer-api`

## 5) Run tests

```bash
ctest --preset conan-release --output-on-failure
```

Run by label when you only need a test slice:

```bash
# Unit tests (gtest)
ctest --preset conan-release -L unit --output-on-failure

# Local API integration tests (binary + curl, no Docker)
ctest --preset conan-release -L local --output-on-failure

# End-to-end Docker tests
ctest --preset conan-release -L e2e --output-on-failure

# Any API-facing tests (local integration + API e2e)
ctest --preset conan-release -L api --output-on-failure
```

Current label taxonomy:

- `unit`: C++ component tests discovered by `gtest_discover_tests`.
- `integration`: local shell-driven API tests.
- `local`: integration tests that run the API binary directly (no Docker).
- `e2e`: Docker Compose based tests.
- `docker`: tests that require Docker.
- `api`: tests that hit API endpoints.
- `regression`: passing tests that cover previously fixed bugs (regression coverage).

## 6) Run the API locally

```bash
./build/build/Release/app/api/deliveryoptimizer-api
```

Optional: override the listen port with `DELIVERYOPTIMIZER_PORT`, for example
`DELIVERYOPTIMIZER_PORT=9090 ./build/build/Release/app/api/deliveryoptimizer-api`.

Prometheus metrics are disabled by default on the shared API listener. Only enable them for
trusted local or internal scraping, for example
`DELIVERYOPTIMIZER_ENABLE_METRICS=1 ./build/build/Release/app/api/deliveryoptimizer-api`.

In another terminal:

```bash
curl -f http://127.0.0.1:8080/health
```

Expected output contains:

```json
{"status":"ok"}
```

## 7) LSP, lint, and format checks

LSP check:

```bash
clangd --check=app/api/src/main.cpp --compile-commands-dir=build/build/Release
```

Lint check:

```bash
clang-tidy app/api/src/main.cpp -p build/build/Release
```

Format check:

```bash
clang-format --dry-run --Werror \
  app/api/src/main.cpp \
  libs/adapters/src/routing_facade.cpp \
  tests/test_smoke.cpp
```

Apply formatting:

```bash
clang-format -i \
  app/api/src/main.cpp \
  libs/adapters/src/routing_facade.cpp \
  tests/test_smoke.cpp
```

## Troubleshooting

- If `cmake --preset conan-release` fails, rerun `conan install ...` first.
- If dependency resolution fails, clear local Conan cache for affected packages and rerun install.
- If `clangd`/`clang-tidy` cannot resolve includes, make sure `build/build/Release/compile_commands.json` exists and Conan/CMake configure finished successfully.
