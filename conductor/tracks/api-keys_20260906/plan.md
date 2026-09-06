# Plan: Named API keys and Bearer auth

TDD: failing unit tests in Docker (`make test-docker`) before implementation. Do not use the host Node toolchain.

## Phase: Schema and key repository

- [ ] Task: Add SQLite migration and API-key repository
  - [ ] Write failing tests for migration `0004` and for create/list/find-by-plaintext/revoke (hash stored, 32+ random bytes, newest first)
  - [ ] Implement `0004_api_keys.sql` and `src/api-keys/repo.ts` using existing SQLite/`query.cjs` wrappers
  - [ ] Run `make test-docker` until green
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase: Bearer auth on `/api/*`

- [ ] Task: Authenticate JSON API with Bearer secrets
  - [ ] Write failing tests: valid Bearer 200 without cookie; missing header and `Bearer not-a-key` 401 exact body; cookie session still 200; last_used_at updates; revoked secret 401
  - [ ] Implement Bearer loading on `/api/*` only; leave `src/legacy/session.cjs` unmodified
  - [ ] Run `make test-docker` until green
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase: Settings UI — create, list, revoke

- [ ] Task: Settings API keys section and routes
  - [ ] Write failing tests for create (plaintext once), list `data-testid`s, reload hides plaintext, revoke, last-used after Bearer use, `YYYY-MM-DD` dates
  - [ ] Implement settings routes and `settings.ejs` section `api-keys-section` with contracted test ids
  - [ ] Run `make test-docker` until green
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase: Smoke gate

- [ ] Task: Confirm existing browser smoke
  - [ ] Run `make smoke` and confirm `4 passed`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
