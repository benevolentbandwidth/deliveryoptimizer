FROM ubuntu:22.04 AS builder

ARG DEBIAN_FRONTEND=noninteractive
ARG VROOM_REF=v1.14.0
ARG VROOM_BUILD_JOBS=2

RUN apt-get update && apt-get install -y --no-install-recommends \
    libasio-dev \
    build-essential \
    ca-certificates \
    ccache \
    git \
    libboost-all-dev \
    liblua5.3-dev \
    libssl-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/vroom
ENV PATH="/usr/lib/ccache:${PATH}"
ENV CCACHE_DIR=/root/.cache/ccache

RUN git clone --recurse-submodules --shallow-submodules --depth 1 --branch "${VROOM_REF}" https://github.com/VROOM-Project/vroom.git /opt/vroom \
    && make -C src -j"${VROOM_BUILD_JOBS}" \
    && install -D /opt/vroom/bin/vroom /usr/local/bin/vroom

FROM ubuntu:22.04

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libboost-date-time1.74.0 \
    libboost-filesystem1.74.0 \
    libboost-iostreams1.74.0 \
    libboost-program-options1.74.0 \
    libboost-regex1.74.0 \
    libboost-system1.74.0 \
    libboost-thread1.74.0 \
    liblua5.3-0 \
    libssl3 \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/bin/vroom /usr/local/bin/vroom
COPY services/deliveryoptimizer-api/server.py /app/server.py

WORKDIR /app

ENV PORT=5000
ENV VROOM_BIN=/usr/local/bin/vroom
ENV VROOM_ROUTER=osrm
ENV VROOM_HOST=osrm
ENV VROOM_PORT=5001
ENV VROOM_TIMEOUT_SECONDS=30
ENV OSRM_URL=http://osrm:5001

EXPOSE 5000

CMD ["python3", "/app/server.py"]
