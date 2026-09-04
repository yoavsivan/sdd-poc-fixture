.PHONY: install dev build test test-docker smoke smoke-local loc clean

install:
	npm ci

dev:
	SEED_USER=demo SEED_PASSWORD=demo-pass-1234 SEED_ITEMS=true \
		npx tsx watch src/server.ts

build:
	npm run build

test:
	npx vitest run

test-docker:
	docker compose build app
	docker compose run --rm --no-deps app npx vitest run

smoke:
	docker compose --profile smoke up --build --abort-on-container-exit --exit-code-from playwright

smoke-local:
	npx playwright test

loc:
	bash scripts/loc-check.sh

# Compose down is tolerant so rm -rf still runs when no daemon is present.
clean:
	docker compose --profile smoke down -v || true
	rm -rf dist data
