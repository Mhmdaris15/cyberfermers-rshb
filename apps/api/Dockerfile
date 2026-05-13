# syntax=docker/dockerfile:1.6
# =====================================================================
#  API image — multi-stage, static binary, non-root runtime.
#
#  Build args:
#    APP_VERSION  (optional) — stamped into version metadata if you wire it
#
#  Includes 5 binaries:
#    /app/bin/server         — HTTP API
#    /app/bin/import         — XLSX → SurrealDB
#    /app/bin/seed           — events / audiences / trends / windows
#    /app/bin/tag-products   — rule + Gemini SKU tagging
#    /app/bin/embed          — Gemini batch embeddings
#
#  Run individually:
#    docker compose -f docker-compose.prod.yml exec api /app/bin/seed
# =====================================================================

# ---- builder ---------------------------------------------------------
FROM golang:1.22-alpine AS build
WORKDIR /src

# git for `go mod`, ca-certs so go can reach TLS-protected proxies.
RUN apk add --no-cache git ca-certificates

# Cache go.mod / go.sum independently of source so module downloads are
# reused across image builds when only application code changes.
# Paths are relative to the repo-root build context (context: .).
COPY apps/api/go.mod apps/api/go.sum* ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download

COPY apps/api/ .

# Build all 5 binaries in one RUN to share the module cache.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server       ./cmd/server && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/import       ./cmd/import && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/seed         ./cmd/seed && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/tag-products ./cmd/tag-products && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/embed        ./cmd/embed

# ---- runtime ---------------------------------------------------------
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata wget && \
    addgroup -g 1000 svoe && adduser -u 1000 -G svoe -D -s /sbin/nologin svoe
ENV TZ=Europe/Moscow

WORKDIR /app

# Binaries
COPY --from=build /out/server       /app/bin/server
COPY --from=build /out/import       /app/bin/import
COPY --from=build /out/seed         /app/bin/seed
COPY --from=build /out/tag-products /app/bin/tag-products
COPY --from=build /out/embed        /app/bin/embed

# Static assets the binaries read at runtime (schema, seed YAMLs).
# `data/raw/` is intentionally NOT copied — the xlsx is huge and
# operator-supplied; mount it at deploy time via `docker cp` or a
# bind mount before running ./bin/import.
COPY infrastructure/surrealdb /app/infrastructure/surrealdb
COPY data/seed                /app/data/seed
RUN mkdir -p /app/data/raw && chown -R svoe:svoe /app

USER svoe
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD sh -c "wget --quiet --spider http://localhost:${API_PORT:-8081}/health || exit 1"

ENTRYPOINT ["/app/bin/server"]
