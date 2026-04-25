# syntax=docker/dockerfile:1.7

ARG UBUNTU_VERSION=24.04
ARG CONAN_VERSION=2.18.1
ARG VROOM_REF=v1.14.0
ARG VROOM_COMMIT=1fd711bc8c20326dd8e9538e2c7e4cb1ebd67bdb
ARG VROOM_BUILD_JOBS=2

FROM --platform=$TARGETPLATFORM ubuntu:${UBUNTU_VERSION} AS builder
ARG CONAN_VERSION
ARG VROOM_REF
ARG VROOM_COMMIT
ARG VROOM_BUILD_JOBS
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
      ccache \
      cmake \
      git \
      libasio-dev \
      libboost-all-dev \
      liblua5.3-dev \
      libssl-dev \
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

RUN git clone --recurse-submodules --shallow-submodules --depth 1 --branch "${VROOM_REF}" \
      https://github.com/VROOM-Project/vroom.git /tmp/vroom \
    && git -C /tmp/vroom fetch --depth 1 origin "${VROOM_COMMIT}" \
    && git -C /tmp/vroom checkout "${VROOM_COMMIT}" \
    && make -C /tmp/vroom/src -j"${VROOM_BUILD_JOBS}" \
    && install -D /tmp/vroom/bin/vroom /usr/local/bin/vroom \
    && strip /usr/local/bin/vroom || true

# Collect binary and linked shared objects into a minimal runtime root.
RUN bash -euo pipefail -c '\
    RUNTIME_ROOT="/tmp/runtime-root"; \
    RUNTIME_LIB_DIR="${RUNTIME_ROOT}/opt/runtime-libs"; \
    RUNTIME_BIN_DIR="${RUNTIME_ROOT}/usr/local/bin"; \
    mkdir -p "${RUNTIME_BIN_DIR}" "${RUNTIME_LIB_DIR}"; \
    cp build/build/Release/app/api/deliveryoptimizer-api "${RUNTIME_BIN_DIR}/deliveryoptimizer-api"; \
    cp /usr/local/bin/vroom "${RUNTIME_BIN_DIR}/vroom"; \
    { \
      ldd build/build/Release/app/api/deliveryoptimizer-api; \
      ldd /usr/local/bin/vroom; \
    } \
      | awk "{if (\$3 ~ /^\\//) print \$3; else if (\$1 ~ /^\\//) print \$1}" \
      | sort -u \
      | while read -r lib; do cp -L "${lib}" "${RUNTIME_LIB_DIR}/"; done'

FROM --platform=$TARGETPLATFORM ubuntu:${UBUNTU_VERSION} AS runtime
ENV DEBIAN_FRONTEND=noninteractive
ENV LD_LIBRARY_PATH=/opt/runtime-libs
ENV VROOM_BIN=/usr/local/bin/vroom
ENV VROOM_ROUTER=osrm
ENV VROOM_HOST=osrm
ENV VROOM_PORT=5001
ENV VROOM_TIMEOUT_SECONDS=30

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /tmp/runtime-root/usr/local/bin/deliveryoptimizer-api /usr/local/bin/deliveryoptimizer-api
COPY --from=builder /tmp/runtime-root/usr/local/bin/vroom /usr/local/bin/vroom
COPY --from=builder /tmp/runtime-root/opt/runtime-libs/ /opt/runtime-libs/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:8080/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/deliveryoptimizer-api"]
