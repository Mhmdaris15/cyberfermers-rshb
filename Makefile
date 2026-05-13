# Hybrid dev: SurrealDB in Docker, API + Web native.
# Run all targets from the repo root.

.PHONY: db db-stop db-logs db-shell api web import seed tag-products dev down clean help devops-run devops-build devops-tidy

help:
	@echo "make db             - start SurrealDB container (port 8000)"
	@echo "make db-stop        - stop the container"
	@echo "make db-logs        - tail surrealdb logs"
	@echo "make db-shell       - open surreal SQL REPL"
	@echo "make api            - run Go API server natively (port 8080)"
	@echo "make web            - run Vite dev server natively (port 5173)"
	@echo "make import         - import farmers_sku.xlsx into SurrealDB"
	@echo "make seed           - seed event KB"
	@echo "make tag-products   - run rule + Gemini tagger over all SKUs"
	@echo "make dev            - start db, then print follow-up commands"
	@echo "make clean          - down -v (wipe surreal volume)"
	@echo "make devops-tidy    - go mod tidy for the devops operator"
	@echo "make devops-run     - run devops operator natively (loads .env.devops)"
	@echo "make devops-build   - build static devops binary into apps/devops/bin/devops"

# ---- Database --------------------------------------------------------
db:
	docker compose up -d surrealdb
	@echo ""
	@echo "SurrealDB up on http://localhost:8000"
	@echo "Next: make api  (in another terminal: make web)"

db-stop:
	docker compose stop surrealdb

db-logs:
	docker compose logs -f --tail=100 surrealdb

db-shell:
	docker compose exec surrealdb /surreal sql \
	  --conn http://localhost:8000 --user root --pass root \
	  --ns rshb --db svoe_rodnoe --pretty

# ---- API (Go, native) -----------------------------------------------
# Config.Load() walks upward to find .env + repo root, so cwd doesn't matter.
api:
	cd apps/api && go run ./cmd/server

import:
	cd apps/api && go run ./cmd/import

seed:
	cd apps/api && go run ./cmd/seed

tag-products:
	cd apps/api && go run ./cmd/tag-products

# ---- Web (Vite, native) ---------------------------------------------
web:
	cd apps/web && npm install --no-audit --no-fund --legacy-peer-deps && npm run dev

# ---- Composite -------------------------------------------------------
dev: db
	@echo ""
	@echo "▶ Now open 3 terminals:"
	@echo "  1) make api"
	@echo "  2) make web"
	@echo "  3) make import && make seed && make tag-products  (first run only)"

down:
	docker compose down

clean:
	docker compose down -v
	@echo "SurrealDB volume wiped."

# ---- DevOps operator (Go, native) -----------------------------------
# Internal service that wraps Coolify API for AI-driven deploys.
# See apps/devops/README.md.
devops-tidy:
	cd apps/devops && go mod tidy

devops-run:
	@test -f .env.devops || (echo "missing .env.devops — copy .env.devops.example first" && exit 1)
	set -a && . ./.env.devops && set +a && cd apps/devops && go run ./cmd/server

devops-build:
	cd apps/devops && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bin/devops ./cmd/server
	@echo "built apps/devops/bin/devops"
