# Deployment guide

Two environments, two compose files. Pick the right one for the job.

| Environment | Compose file | What runs in Docker | What runs natively |
|---|---|---|---|
| **Local dev** | `docker-compose.yml` | SurrealDB only | API (Go), Web (Vite) |
| **Production** | `docker-compose.prod.yml` | SurrealDB + API + Web | Nothing |

---

## 1 · Local dev (current default)

Optimised for **fast iteration** — Vite HMR runs natively, Go rebuilds in <2s.

```powershell
# 1. configure env (one-time)
Copy-Item .env.example .env
# fill in GEMINI_API_KEY

# 2. start the DB
.\dev.ps1 db      # docker compose up -d surrealdb

# 3. one-off bootstrap (only when the schema or seeds change)
.\dev.ps1 import
.\dev.ps1 seed
.\dev.ps1 tag

# 4. day-to-day
.\dev.ps1 api     # terminal A
.\dev.ps1 web     # terminal B
```

Open <http://localhost:5173> for the FE.

---

## 2 · Production (containerised, Cloudify-friendly)

Everything containerised. The **only** internet-exposed port is the web
container's `${WEB_PORT}` (default `8080`). Put a TLS-terminating reverse
proxy in front of it.

### 2.1 · Prepare the environment

```bash
# one-time on the target VM
cp .env.production.example .env.production
$EDITOR .env.production
#   → set GEMINI_API_KEY, SURREAL_PASS, PUBLIC_API_URL, API_CORS_ORIGINS
```

What lives in `.env.production`:

- **`GEMINI_API_KEY`** — required for chat + content generation + embeddings.
- **`SURREAL_PASS`** — strong password. The DB port is internal-only so this
  isn't internet-exposed, but it's still the root credential.
- **`PUBLIC_API_URL`** — leave empty for same-origin (FE → `/api` → nginx
  proxy → api). Set only if FE and BE live on different hostnames.
- **`API_CORS_ORIGINS`** — comma list of allowed FE origins (https).
- **`WEB_PORT`** — port the web container exposes on the host.

### 2.2 · Build + start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

That's three containers wired into the `svoe-net-prod` bridge network:

```
internet
   │
   ▼  :${WEB_PORT}
 web (nginx)  ─── /api/* ───►  api (Go)
                                  │
                                  ▼
                              surrealdb (rocksdb on named volume)
```

### 2.3 · Bootstrap data (one-time per fresh DB)

```bash
# Copy your farmers_sku.xlsx into the API container
docker cp ./data/raw/farmers_sku.xlsx svoe-api-prod:/app/data/raw/farmers_sku.xlsx

# Run the bootstrap binaries
docker compose -f docker-compose.prod.yml exec api /app/bin/import
docker compose -f docker-compose.prod.yml exec api /app/bin/seed
docker compose -f docker-compose.prod.yml exec api /app/bin/tag-products

# Optional — populate vector embeddings (events + audiences + trends by default;
# add --target=product to embed the full 3,491-SKU catalog too)
docker compose -f docker-compose.prod.yml exec api /app/bin/embed
```

### 2.4 · Health checks

```bash
docker compose -f docker-compose.prod.yml ps
# Every service should be "healthy" within 30s.

curl -fsS http://localhost:8080/healthz   # nginx liveness
curl -fsS http://localhost:8080/api/health # api liveness via the proxy
```

### 2.5 · Logs + ops

```bash
docker compose -f docker-compose.prod.yml logs -f --tail=200 api
docker compose -f docker-compose.prod.yml logs -f --tail=200 web
docker compose -f docker-compose.prod.yml logs -f --tail=200 surrealdb
```

Each container ships JSON logs capped at `10m × 3-5 files` so you won't fill
the host disk.

### 2.6 · Updates

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
# rolling restart per service; volume + DB state preserved.
```

For a **clean wipe** (irreversible, deletes all farmer/event/memory data):

```bash
docker compose -f docker-compose.prod.yml down -v
```

---

## 3 · Cloudify integration

The `docker-compose.prod.yml` is intentionally **self-contained** — no
relative paths outside the repo, no implicit host bind mounts (except
the operator-supplied xlsx which is `docker cp`-ed in once). That makes
it directly liftable as a Cloudify `docker.Container` or `compose` blueprint.

Two reasonable Cloudify patterns:

### 3a · Build on the host (simplest)

```yaml
# tosca-style snippet
node_templates:
  svoe-stack:
    type: cloudify.nodes.docker.Compose
    properties:
      compose_file: docker-compose.prod.yml
      env_file: .env.production
      project_name: svoe-rodnoe-prod
```

Cloudify runs `docker compose -f … up -d --build` on the target VM. The
VM needs Docker Engine + buildkit; nothing else. Inputs in your blueprint
can override individual env keys at deploy time.

### 3b · Pre-built images in a registry (faster deploys)

If you want zero on-host build time, push images to a registry first:

```bash
# build + tag
docker compose -f docker-compose.prod.yml build
docker tag svoe-rodnoe-prod-api:latest registry.example.com/svoe-api:1.0.0
docker tag svoe-rodnoe-prod-web:latest registry.example.com/svoe-web:1.0.0

# push
docker push registry.example.com/svoe-api:1.0.0
docker push registry.example.com/svoe-web:1.0.0
```

Then change the compose to reference `image:` instead of `build:` (or
ship a `docker-compose.prod.registry.yml` overlay).

### 3c · Secrets

Both patterns load `.env.production` from disk. For Cloudify-managed
secrets, fetch them at deploy time and write them to `.env.production`
before invoking compose. Don't bake secrets into the image.

---

## 4 · TLS / reverse proxy

The web container speaks plain HTTP on `${WEB_PORT}`. Terminate TLS at
your edge:

### Caddy one-liner

```caddyfile
kiberfarmers.example.com {
    reverse_proxy localhost:8080 {
        flush_interval -1   # required for SSE on /api/farmers/:id/stream
    }
}
```

### Nginx snippet

```nginx
server {
    listen 443 ssl http2;
    server_name kiberfarmers.example.com;
    ssl_certificate     /etc/letsencrypt/live/kiberfarmers/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kiberfarmers/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_buffering off;          # SSE needs this
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

**Do not** publish the SurrealDB or API ports directly. The compose file
uses `expose` (intra-network) rather than `ports` (host-published) for
them on purpose.

---

## 5 · Common operational tasks

| Task | Command |
|---|---|
| Restart just the API after a code change | `docker compose -f docker-compose.prod.yml up -d --build api` |
| Re-seed events YAML after an editorial change | `docker compose -f docker-compose.prod.yml exec api /app/bin/seed` |
| Re-tag products after rules tweak | `docker compose -f docker-compose.prod.yml exec api /app/bin/tag-products` |
| Trigger an embedding pass for events+audiences+trends only | `docker compose -f docker-compose.prod.yml exec api /app/bin/embed` |
| Open Surreal SQL REPL | `docker compose -f docker-compose.prod.yml exec surrealdb /surreal sql --conn http://localhost:8000 --user root --pass $SURREAL_PASS --ns rshb --db svoe_rodnoe --pretty` |
| Tail per-service logs | `docker compose -f docker-compose.prod.yml logs -f api web` |
| Wipe + rebuild from scratch | `down -v && up -d --build` |

---

## 6 · Cost protection in production

The cost-critical code paths are documented in the recent commits, but
the production-relevant knobs are:

- `EMBED_RATE_LIMIT_PER_MIN` — default 60. Bump to 200 if you have a
  paid Gemini tier and want faster bootstrap.
- `TAGGING_RATE_LIMIT_PER_MIN` — default 15. Same logic.
- `cmd/embed` skips rows whose canonical text hash is already cached,
  so re-running on a stable catalog is **0 API calls**.
- `/generate` skips channels that already have content at the requested
  variant + prompt version. Re-opening an action sheet is **0 API calls**.

See `docs/SURREALDB_ARCHITECTURE.md` for the full cost-protection model.
