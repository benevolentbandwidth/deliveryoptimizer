# syntax=docker/dockerfile:1.7

ARG UBUNTU_VERSION=24.04
ARG CONAN_VERSION=2.9.2

FROM --platform=$TARGETPLATFORM ubuntu:${UBUNTU_VERSION} AS builder
ARG CONAN_VERSION
ARG TARGETPLATFORM
ARG TARGETARCH
ARG TARGETVARIANT

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    CONAN_HOME=/tmp/conan-home \
    PATH=/opt/venv/bin:$PATH

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends \
      build-essential \
      cmake \
      git \
      ninja-build \
      pkg-config \
      python3 \
      python3-venv \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir "conan==${CONAN_VERSION}"

WORKDIR /workspace

COPY conanfile.py CMakeLists.txt ./
COPY cmake ./cmake
COPY app/api ./app/api
COPY libs ./libs

# Docker resolves TARGETPLATFORM; conan detects and builds for that architecture (for example linux/arm64).
# Tests are disabled in container builds to reduce build time.
RUN --mount=type=cache,target=/tmp/conan-home,sharing=locked \
    conan profile detect --force \
    && conan install . \
      --output-folder=build \
      --build=missing \
      -s:h build_type=Release \
      -s:b build_type=Release \
    && cmake -S . -B build/build/Release \
      -G "Unix Makefiles" \
      -DCMAKE_TOOLCHAIN_FILE=build/build/Release/generators/conan_toolchain.cmake \
      -DCMAKE_BUILD_TYPE=Release \
      -DDELIVERYOPTIMIZER_ENABLE_TESTS=OFF \
    && cmake --build build/build/Release --target deliveryoptimizer_api -j"$(nproc)" \
    && strip build/build/Release/app/api/deliveryoptimizer-api || true

# Collect binary and linked shared objects into a minimal runtime root.
RUN bash -euo pipefail -c '\
    BIN="build/build/Release/app/api/deliveryoptimizer-api"; \
    RUNTIME_ROOT="/tmp/runtime-root"; \
    RUNTIME_LIB_DIR="${RUNTIME_ROOT}/opt/runtime-libs"; \
    mkdir -p "${RUNTIME_ROOT}/usr/local/bin" "${RUNTIME_LIB_DIR}"; \
    cp "${BIN}" "${RUNTIME_ROOT}/usr/local/bin/deliveryoptimizer-api"; \
    ldd "${BIN}" \
      | awk "{if (\$3 ~ /^\\//) print \$3; else if (\$1 ~ /^\\//) print \$1}" \
      | sort -u \
      | while read -r lib; do cp -L "${lib}" "${RUNTIME_LIB_DIR}/"; done'

FROM --platform=$TARGETPLATFORM ubuntu:${UBUNTU_VERSION} AS runtime
ENV DEBIAN_FRONTEND=noninteractive
ENV LD_LIBRARY_PATH=/opt/runtime-libs

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /tmp/runtime-root/usr/local/bin/deliveryoptimizer-api /usr/local/bin/deliveryoptimizer-api
COPY --from=builder /tmp/runtime-root/opt/runtime-libs/ /opt/runtime-libs/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:8080/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/deliveryoptimizer-api"]
