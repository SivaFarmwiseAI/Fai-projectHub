# ── ProjectHub Backend Makefile ─────────────────────────────────────────────
.PHONY: install migrate migrate-remote seed test package refresh-views clean \
        build deploy deploy-guided deploy-staging logs local-api validate

PYTHON   := python3
PIP      := pip3
DB_URL   ?= postgresql://postgres:postgres@localhost:5432/projecthub

# ── Local setup ──────────────────────────────────────────────────────────────

install:
	$(PIP) install -r requirements.txt

# ── Database ─────────────────────────────────────────────────────────────────

db-create:
	psql -U postgres -c "CREATE DATABASE projecthub;" || true

migrate:
	psql $(DB_URL) -f migrations/001_schema.sql
	psql $(DB_URL) -f migrations/002_indexes.sql
	psql $(DB_URL) -f migrations/003_functions.sql
	psql $(DB_URL) -f migrations/004_views.sql
	@echo "✓ Migrations applied"

seed:
	DATABASE_URL=$(DB_URL) $(PYTHON) seed/seed.py

db-reset:
	psql -U postgres -c "DROP DATABASE IF EXISTS projecthub; CREATE DATABASE projecthub;"
	$(MAKE) migrate
	$(MAKE) seed

# ── Tests ─────────────────────────────────────────────────────────────────────

test:
	DATABASE_URL=$(DB_URL) pytest tests/ -v

# ── Lambda deployment ─────────────────────────────────────────────────────────

package:
	pip install --target ./package -r requirements.txt
	cd package && zip -r ../deployment.zip .
	zip -g deployment.zip -r src/ migrations/ seed/

# Migrate remote DB (set DB_URL to the RDS endpoint before running)
migrate-remote:
	@test -n "$(DB_URL)" || (echo "DB_URL is required" && exit 1)
	psql $(DB_URL) -f migrations/001_schema.sql
	psql $(DB_URL) -f migrations/002_indexes.sql
	psql $(DB_URL) -f migrations/003_functions.sql
	psql $(DB_URL) -f migrations/004_views.sql
	@echo "✓ Remote migrations applied"

# Refresh materialized views (useful after bulk data loads)
refresh-views:
	psql $(DB_URL) -c "SELECT refresh_analytics_views();"

# ── Cleanup ──────────────────────────────────────────────────────────────────

clean:
	rm -rf __pycache__ .pytest_cache deployment.zip package/ .aws-sam/
	find . -name "*.pyc" -delete

# ── SAM Build Targets ─────────────────────────────────────────────────────────
# SAM calls `make build-<FunctionName>` inside a Docker container (Amazon Linux)
# with ARTIFACTS_DIR set to the function's output directory.
# Each target copies only the application source – Python deps come from the Layer.

SAM_FUNCTIONS := HealthFunction AuthFunction UsersFunction ProjectsFunction \
	TasksFunction PhasesFunction AnalyticsFunction AIFunction CaptureFunction \
	DiscussionsFunction ReviewsFunction StandupFunction SubmissionsFunction LeaveFunction

$(addprefix build-,$(SAM_FUNCTIONS)):
	mkdir -p "$(ARTIFACTS_DIR)"
	cp -r src "$(ARTIFACTS_DIR)/src"

# ── SAM Commands ──────────────────────────────────────────────────────────────

SAM_ENV ?= default

# Build all Lambda functions and the shared dependency layer.
# Requires Docker (uses --use-container for Amazon Linux compatibility).
build:
	sam build --use-container --parallel --cached

# Deploy to production (requires prior `make build`).
deploy: build
	sam deploy --config-env $(SAM_ENV)

# First-time interactive deploy (walks through all settings).
deploy-guided:
	sam deploy --guided

# Deploy to staging environment.
deploy-staging: build
	sam deploy --config-env staging

# Tail logs for all functions in the production stack.
logs:
	sam logs --stack-name projecthub-api-production --tail

# Start local API Gateway on port 3001 (useful for frontend integration testing).
# Requires a local .env file – see .env.example.
local-api:
	sam local start-api --port 3001 --env-vars .env.json

# Validate the SAM template syntax and IAM policies.
validate:
	sam validate --lint

