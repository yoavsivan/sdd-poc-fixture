# Plan: Rotate API keys

TDD per `conductor/workflow.md`. Verification uses `make test-docker`.

## Phase 1: Rotate in persistence

- [ ] Task: Write failing tests for rotate
  - [ ] Repo: rotate keeps id and name, returns a new plaintext, old secret misses, new secret hits, lastRotatedAt is set
  - [ ] Run `make test-docker` and confirm the new tests fail
- [ ] Task: Implement rotate on the api_keys row
  - [ ] Add `last_rotated_at` (migration `0005_api_keys_rotated.sql`)
  - [ ] Replace hash/prefix/last4; keep id, name, created_at, user_id
  - [ ] Run `make test-docker` and confirm tests pass
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Settings Rotate control

Maps to AC 1, 2, 3.

- [ ] Task: Write failing tests for Settings rotate
  - [ ] POST rotate shows new `api-key-plaintext`, same name, `api-key-last-rotated` as `YYYY-MM-DD`
  - [ ] Old Bearer secret → 401 exact body; new secret → 200
  - [ ] One `api-key-row` remains (no second row)
  - [ ] Run `make test-docker` and confirm the new tests fail
- [ ] Task: Implement rotate route and UI
  - [ ] `POST /settings/api-keys/:id/rotate` with CSRF; flash new plaintext once
  - [ ] Add `api-key-rotate` and `api-key-last-rotated`
  - [ ] Run `make test-docker` and confirm tests pass
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Smoke regression

- [ ] Task: Run existing smoke and confirm it stays green
  - [ ] `make smoke` → `4 passed`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
