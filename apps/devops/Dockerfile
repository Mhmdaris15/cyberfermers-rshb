# syntax=docker/dockerfile:1.6
# =====================================================================
#  DevOps Operator — multi-stage, static binary, non-root runtime.
#  Build context MUST be the repo root:
#     docker build -f apps/devops/Dockerfile -t svoe-devops .
#
#  The image only ships ONE binary (no migrations / loaders) — this is
#  a small focused service whose only job is to proxy a whitelisted
#  subset of Coolify API calls.
# =====================================================================

# ---- builder ---------------------------------------------------------
FROM golang:1.22-alpine AS build
WORKDIR /src

RUN apk add --no-cache git ca-certificates

# Cache go.mod / go.sum independently of source.
COPY apps/devops/go.mod apps/devops/go.sum* ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download || true

COPY apps/devops/ .

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" \
        -o /out/devops ./cmd/server

# ---- runtime ---------------------------------------------------------
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata wget && \
    addgroup -g 1000 devops && adduser -u 1000 -G devops -D -s /sbin/nologin devops
ENV TZ=Europe/Moscow

WORKDIR /app
COPY --from=build /out/devops /app/bin/devops

USER devops
EXPOSE 9090

# Healthcheck hits the unauthenticated /health endpoint inside the container.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://localhost:9090/health || exit 1

ENTRYPOINT ["/app/bin/devops"]
