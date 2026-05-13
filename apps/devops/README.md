# DevOps Operator

> **Internal-only** HTTP API that wraps a *whitelisted* subset of the
> Coolify v4 REST API. Designed to be driven by an AI agent (Claude
> Code, future MCP servers, custom automation) so deployments can
> happen without ever handing the agent docker / shell / kubectl.

---

## Why this exists

We want AI agents to be able to **trigger deployments, watch status,
fetch logs, and restart services** — and *only* those four verbs, on
*only* the applications we pre-approve. Giving an agent SSH or
`docker exec` would let it do anything; giving it a single Coolify PAT
would let it deploy *every* app in the org. This operator is the
narrow waist between the two.

```
┌──────────────────┐   POST /deploy      ┌───────────────────┐    POST /api/v1/deploy   ┌─────────┐
│  Claude / MCP /  │ ──────────────────► │  devops operator  │ ────────────────────────►│ Coolify │
│  internal cron   │   Authorization:    │  (this service)   │   Authorization:         │  v4 API │
│                  │     Bearer <SECRET> │                   │     Bearer <COOLIFY_PAT> │         │
└──────────────────┘                     └───────────────────┘                          └─────────┘
                                                 │
                                                 ├─ enforces allowlist (DEVOPS_ALLOWED_APPS)
                                                 ├─ never logs tokens
                                                 ├─ 30s upstream timeout
                                                 └─ structured slog JSON
```

---

## Architecture

```
apps/devops/
├── cmd/server/                 main.go — boot, graceful shutdown
├── internal/devops/
│   ├── client/coolify.go       thin HTTP client (Bearer auth, JSON in/out)
│   ├── services/deploy.go      policy layer — applies allowlist BEFORE calling client
│   ├── handlers/handlers.go    gin handlers — thin adapters, error → HTTP mapping
│   ├── middleware/             auth, request logger, panic recovery
│   ├── models/                 DTOs for handlers ↔ services ↔ client
│   └── config/                 env loading + validation
├── Dockerfile                  multi-stage, static binary, non-root
├── go.mod
└── README.md  (this file)
```

Single binary, single port, single concern. No persistence, no DB, no
cache — every call is a stateless pass-through to Coolify.

---

## REST surface

All routes except `/health` require `Authorization: Bearer <DEVOPS_INTERNAL_TOKEN>`.

| Method | Path        | Body / Query                                  | Response                  |
|--------|-------------|-----------------------------------------------|---------------------------|
| GET    | `/health`   | —                                             | `200 {"status":"ok"}`     |
| POST   | `/deploy`   | `{"application_uuid":"…","force":false}`      | `202 DeployResponse`      |
| GET    | `/status`   | `?application_uuid=…` *or* `?deployment_uuid=…` | `200 StatusResponse`    |
| GET    | `/logs`     | `?application_uuid=…&lines=200`               | `200 LogsResponse`        |
| POST   | `/restart`  | `{"application_uuid":"…"}`                    | `202 RestartResponse`     |

Error envelope:
```json
{ "error": "human readable", "code": "machine_readable" }
```

Codes you'll see: `invalid_body`, `missing_param`, `not_allowlisted`,
`unauthorized`, `upstream_error`, `panic`.

---

## Setup

### 1. Native (development)

```bash
# from repo root
cp .env.devops.example .env.devops
$EDITOR .env.devops        # set DEVOPS_INTERNAL_TOKEN + COOLIFY_TOKEN + DEVOPS_ALLOWED_APPS

cd apps/devops
go mod tidy                # first-run only — pulls gin and its transitives

# load env and run
set -a && . ../../.env.devops && set +a
go run ./cmd/server
```

Or via the repo Makefile (handles env loading for you):

```bash
make devops-run
```

### 2. Docker

```bash
# from repo root
docker build -f apps/devops/Dockerfile -t svoe-devops:latest .
docker run --rm \
  --env-file .env.devops \
  -p 127.0.0.1:9090:9090 \
  svoe-devops:latest
```

Or via the existing prod stack (compose service `devops` is defined in
`docker-compose.prod.yml`):

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d devops
```

---

## Coolify integration

You need a Coolify Personal Access Token. Create one in:

> Coolify UI → top-right avatar → **Keys & Tokens** → **API tokens**
> → New token (read + write on applications & deployments)

Paste it into `.env.devops` as `COOLIFY_TOKEN`.

Then list the Coolify **application UUIDs** this operator is allowed
to touch in `DEVOPS_ALLOWED_APPS` (comma-separated). You can find a
UUID in the URL of any Coolify application page:

```
https://coolify.example.com/projects/<project>/applications/<APPLICATION_UUID>
```

**Empty allowlist = everything is rejected.** That's the safe default;
don't relax it without thinking.

### Smoke test

```bash
# fetch most recent deployment for an allowlisted app
curl -sS http://localhost:9090/status \
  -H "Authorization: Bearer $DEVOPS_INTERNAL_TOKEN" \
  --get --data-urlencode "application_uuid=YOUR_APP_UUID" | jq

# trigger a deploy
curl -sS -X POST http://localhost:9090/deploy \
  -H "Authorization: Bearer $DEVOPS_INTERNAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"application_uuid":"YOUR_APP_UUID","force":false}' | jq
```

---

## Security warnings

Read these. The operator is small precisely so the threat model is small.

1. **NEVER expose this service to the public internet.** Bind it to
   `127.0.0.1` (default), reach it only from same-host containers or
   over a Wireguard / Tailscale link.
2. **Two tokens, two purposes.** `DEVOPS_INTERNAL_TOKEN` authenticates
   the *caller* (the AI agent). `COOLIFY_TOKEN` authenticates *us* to
   Coolify. They are never the same value, and the operator never
   echoes either of them — not in logs, not in error bodies, not in
   response payloads.
3. **No arbitrary execution.** There is no `/exec`, no `/shell`, no
   `/proxy` endpoint. If a future feature is tempted to forward a
   raw URL or shell command, it doesn't belong here — write a new
   endpoint that takes only typed parameters.
4. **Allowlist is mandatory.** `DEVOPS_ALLOWED_APPS` gates every
   operation. The `/status?deployment_uuid=…` form re-checks the
   allowlist on the *returned* application UUID so the deployment
   list can't be used as a UUID discovery oracle.
5. **Timeouts cap blast radius.** Upstream calls timeout at 30s
   (configurable). The server itself caps request bodies via gin's
   defaults and rejects requests with no `Content-Length`.
6. **Token comparison is constant-time** (`crypto/subtle`). Don't
   replace it with `==`.
7. **No persistence.** Logs go to stdout (capture with whatever runs
   the process). The operator holds zero state on disk, so a stolen
   image is worth nothing without the env vars.

---

## Future: Claude Code integration via MCP

The eventual goal is to expose this surface as an MCP server so Claude
Code can call it natively (no `curl` plumbing in the prompt). Shape
of that integration:

```
Claude Code  ◀── stdio JSON-RPC ──▶  devops-mcp-server  ◀── HTTP ──▶  devops operator (this)
                                              │
                                              └─ ships tools: deploy, status, logs, restart
                                              └─ same allowlist enforced server-side
```

The MCP server will live at `apps/devops/cmd/mcp/` and re-use the
existing `services/` and `client/` packages — only the transport
changes. Auth stays the same shared-secret model; the MCP server is
just another client of the HTTP API.

This README will get an "MCP" section once that lands.

---

## Operational notes

- **Logging:** structured JSON via `log/slog` on stdout. One line per
  HTTP request, one line per Coolify call. Tokens are never logged.
- **Healthcheck:** `GET /health` is unauthenticated and has zero
  dependencies — Docker / Coolify can poll it without leaking secrets
  and without flapping when Coolify upstream is down.
- **Graceful shutdown:** SIGTERM / SIGINT triggers a 15s drain. In-flight
  Coolify requests get their full upstream timeout to complete.
- **Restart policy:** in production, run under `restart: unless-stopped`
  (already configured in `docker-compose.prod.yml`).

---

## License

Same as the parent project (MIT).
