# Plan: Named API keys and Bearer auth

TDD: failing unit tests in Docker (`make test-docker`) before implementation. Do not use the host Node toolchain.

## Phase: Schema and key repository [checkpoint: 737fa13]

- [x] Task: Add SQLite migration and API-key repository
  - [x] Write failing tests for migration `0004` and for create/list/find-by-plaintext/revoke (hash stored, 32+ random bytes, newest first)
  - [x] Implement `0004_api_keys.sql` and `src/api-keys/repo.ts` using existing SQLite/`query.cjs` wrappers
  - [x] Run `make test-docker` until green
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase: Bearer auth on `/api/*` [checkpoint: 737fa13]

- [x] Task: Authenticate JSON API with Bearer secrets
  - [x] Write failing tests: valid Bearer 200 without cookie; missing header and `Bearer not-a-key` 401 exact body; cookie session still 200; last_used_at updates; revoked secret 401
  - [x] Implement Bearer loading on `/api/*` only; leave `src/legacy/session.cjs` unmodified
  - [x] Run `make test-docker` until green
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase: Settings UI — create, list, revoke [checkpoint: 737fa13]

- [x] Task: Settings API keys section and routes
  - [x] Write failing tests for create (plaintext once), list `data-testid`s, reload hides plaintext, revoke, last-used after Bearer use, `YYYY-MM-DD` dates
  - [x] Implement settings routes and `settings.ejs` section `api-keys-section` with contracted test ids
  - [x] Run `make test-docker` until green
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase: Smoke gate [checkpoint: 737fa13]

- [x] Task: Confirm existing browser smoke
  - [x] Run `make smoke` and confirm `4 passed`
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase: Review Fixes
- [x] Task: Apply review suggestions 9b5e058
