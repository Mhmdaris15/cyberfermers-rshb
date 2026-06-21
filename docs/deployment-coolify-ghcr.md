# Image-based deployment — GitHub Actions + GHCR + Coolify

> **Status:** active. This replaces the "Coolify builds from source" flow
> documented in §2 / §3 of `docs/deployment.md`. The local dev flow in
> §1 of that file is unchanged.

```
push main ──▶ GitHub Actions ──▶ ghcr.io/<owner>/<repo>-{api,web}:<tag>
                                            │
                                            └─▶ Coolify pulls + recreate
```

CI/CD owns the build; Coolify only runs `docker pull` + `up -d`.

## What changed in the repo

| File | Change |
|---|---|
| `.github/workflows/build-and-push.yml` | **NEW** — matrix-builds api + web, pushes to GHCR, optionally pings Coolify |
| `docker-compose.prod.yml` | `build:` → `image: ${API_IMAGE:-…}` / `image: ${WEB_IMAGE:-…}` + `pull_policy: always` |
| `apps/api/Dockerfile` | unchanged |
| `apps/web/Dockerfile` | unchanged |

## Image names

Driven by `${{ github.repository }}` in the workflow — image paths follow
the repo slug automatically. For the canonical fork these resolve to:

```
ghcr.io/mhmdaris15/cyberfermers-rshb-api:<tag>
ghcr.io/mhmdaris15/cyberfermers-rshb-web:<tag>
```

Tags emitted per build:

| Tag | When | Use for |
|---|---|---|
| `latest` | only on `main` | normal deploys |
| `sha-abc1234` | every commit | **rollback target — immutable** |
| `<branch>` | every branch push | preview / feature deploys |
| `vX.Y.Z` | git tag push | tagged releases |

Compose pins `:latest` by default. Override per deploy via
`.env.production`:

```env
API_IMAGE=ghcr.io/mhmdaris15/cyberfermers-rshb-api:sha-abc1234
WEB_IMAGE=ghcr.io/mhmdaris15/cyberfermers-rshb-web:sha-abc1234
```

## One-time setup

### 1. First run

Push the new files to `main`. The first workflow run will build and push
both images. Verify in **GitHub → Your repo → Packages**. Each service
becomes a separate GHCR package.

### 2. Decide image visibility

GHCR packages default to **private**. Two paths:

- **Public images** (simplest): GitHub → Profile → Packages → click each
  package → *Package settings* → *Change visibility* → Public.
  Coolify needs no credentials. Recommended for an open hackathon project.

- **Private images**: create a classic GitHub PAT with the
  `read:packages` scope, then in Coolify add a registry credential
  pointing at `ghcr.io` (username = your GH handle, password = PAT).

### 3. Configure repo Variables (optional)

Only needed if you DON'T want same-origin defaults:

| Variable | Default | Effect |
|---|---|---|
| `VITE_API_URL` | `""` | Empty = FE uses relative `/api` (nginx proxies it). Set only if FE and API live on different origins. |
| `VITE_APP_NAME` | `Свое Родное · Calendar` | Browser tab title baked into the bundle. |

GitHub → Settings → **Secrets and variables** → **Variables** → New
repository variable. These are NOT secrets — they end up in the public
JS bundle.

### 4. Switch the Coolify resource from "build" to "pull"

The existing Coolify application is configured to clone the repo and run
`docker compose -f docker-compose.prod.yml up -d --build`. After this
change it should only do `pull` + `up -d`. Step-by-step:

1. Open the existing application in Coolify.
2. **Stop** the running stack (so it isn't disturbed mid-switch).
3. In **Configuration** / source settings, keep the git source pointing
   at this repo with compose file `docker-compose.prod.yml`. Coolify
   still needs the compose file to know the service shape — but it will
   no longer build anything because the file has no `build:` blocks.
4. **Disable** any "build from source" / "auto-build before deploy"
   toggles. Coolify should reduce its deploy step to `docker compose
   pull` + `up -d --remove-orphans`.
5. In **Environment Variables**, add the two image-pin overrides plus
   everything `.env.production` used to carry (Surreal creds, Gemini
   key, CORS allowlist, admin bootstrap):
   ```
   API_IMAGE=ghcr.io/mhmdaris15/cyberfermers-rshb-api:latest
   WEB_IMAGE=ghcr.io/mhmdaris15/cyberfermers-rshb-web:latest
   SURREAL_USER=…
   SURREAL_PASS=…
   GEMINI_API_KEY=…
   API_CORS_ORIGINS=https://your.tld
   ADMIN_USERNAME=…
   ADMIN_PASSWORD=…
   ```
6. If you went with **private** GHCR images, attach the registry
   credential to the resource.
7. Click **Deploy**. Verify on the host:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   docker compose -f docker-compose.prod.yml images
   ```
   Both api and web should show `ghcr.io/…` images, not locally-built
   hashes.

### 5. Wire auto-deploy (optional)

So `git push main` → image build → automatic Coolify redeploy:

1. In Coolify, on the resource page, copy the **Deploy Webhook URL**
   (one per resource).
2. If the webhook requires auth, copy its token too.
3. GitHub → repo → Settings → **Secrets and variables** → **Actions**
   → **Secrets** → New repository secret:
   - `COOLIFY_WEBHOOK_URL` = the URL from step 1
   - `COOLIFY_WEBHOOK_TOKEN` = the token (only if needed)
4. Done. The workflow's `deploy` job POSTs to the webhook after both
   images push successfully on `main` or a `vX.Y.Z` tag.

If `COOLIFY_WEBHOOK_URL` is not set, the deploy job logs a notice and
exits cleanly — you'll just need to click "Redeploy" in Coolify
manually after each build.

## Rollback

Two routes, depending on urgency:

- **Fast (≈30s)** — pin to a known-good SHA tag in Coolify env vars,
  click redeploy:
  ```
  API_IMAGE=ghcr.io/mhmdaris15/cyberfermers-rshb-api:sha-abc1234
  WEB_IMAGE=ghcr.io/mhmdaris15/cyberfermers-rshb-web:sha-abc1234
  ```
  Bypasses CI entirely. This is why every commit gets a SHA tag.

- **Slower (CI loop)** — `git revert` the bad commit on `main`. The
  workflow runs, pushes a new `:latest`, the webhook redeploys.

Prefer the SHA-pin path during incidents.

## Local development

`docker-compose.yml` (NOT `.prod.yml`) is still build-from-source.
Nothing about local dev changes — see `docs/deployment.md` §1.

To smoke-test the production compose locally:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## Why this layout

- **One workflow, two images (matrix)** — both build in parallel on
  separate runners; failures are isolated.
- **`docker/metadata-action`** — single source for tag generation;
  consistent across services and lower-cases the repo owner so GHCR
  pulls always resolve.
- **`type=gha,scope=<service>` cache** — keeps api and web layer caches
  independent. Each warm rebuild is roughly 30–90 s.
- **Single-arch `linux/amd64`** — Coolify hosts are almost universally
  amd64; multi-arch doubles CI time for no benefit. Add `linux/arm64`
  later if you deploy to Graviton/M-series.
- **`pull_policy: always`** on the compose services — `docker compose
  up -d` won't re-pull `:latest` by default; without this, Coolify
  would silently keep running the stale image. Belt + suspenders with
  the webhook trigger.
- **`provenance: false`** — Buildx defaults to attestations that
  produce extra package versions in GHCR. Off for cleanliness.
