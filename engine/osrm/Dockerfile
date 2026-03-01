FROM ubuntu:22.04

ARG DEBIAN_FRONTEND=noninteractive
ARG OSRM_REF=v5.27.1
ARG OSRM_BUILD_JOBS=2
ARG OSRM_CXX_FLAGS="-Wno-error=free-nonheap-object -Wno-free-nonheap-object"

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    ccache \
    cmake \
    curl \
    git \
    libboost-all-dev \
    libbz2-dev \
    liblua5.3-dev \
    libprotobuf-dev \
    libstxxl-dev \
    libstxxl1v5 \
    libtbb-dev \
    libxml2-dev \
    libzip-dev \
    lua5.3 \
    ninja-build \
    pkg-config \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/osrm-backend

RUN git clone --depth 1 --branch "${OSRM_REF}" https://github.com/Project-OSRM/osrm-backend.git /opt/osrm-backend \
    && cmake -S . -B build -G Ninja \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_CXX_FLAGS="${OSRM_CXX_FLAGS}" \
      -DCMAKE_C_COMPILER_LAUNCHER=ccache \
      -DCMAKE_CXX_COMPILER_LAUNCHER=ccache \
    && cmake --build build --target install -j"${OSRM_BUILD_JOBS}"

COPY engine/osrm/entrypoint.sh /usr/local/bin/osrm-entrypoint.sh
RUN chmod +x /usr/local/bin/osrm-entrypoint.sh

WORKDIR /data
EXPOSE 5001

ENTRYPOINT ["/usr/local/bin/osrm-entrypoint.sh"]
