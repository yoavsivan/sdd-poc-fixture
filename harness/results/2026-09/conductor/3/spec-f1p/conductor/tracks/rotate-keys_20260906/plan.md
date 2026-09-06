# Plan: Rotate API keys

TDD per `conductor/workflow.md`. Verification uses `make test-docker`.

## Phase 1: Rotate in persistence [checkpoint: 7e75b73]

- [x] Task: Write failing tests for rotate
  - [x] Repo: rotate keeps id and name, returns a new plaintext, old secret misses, new secret hits, lastRotatedAt is set
  - [x] Run `make test-docker` and confirm the new tests fail
- [x] Task: Implement rotate on the api_keys row
  - [x] Add `last_rotated_at` (migration `0005_api_keys_rotated.sql`)
  - [x] Replace hash/prefix/last4; keep id, name, created_at, user_id
  - [x] Run `make test-docker` and confirm tests pass
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Settings Rotate control [checkpoint: 7e75b73]

Maps to AC 1, 2, 3.

- [x] Task: Write failing tests for Settings rotate
  - [x] POST rotate shows new `api-key-plaintext`, same name, `api-key-last-rotated` as `YYYY-MM-DD`
  - [x] Old Bearer secret → 401 exact body; new secret → 200
  - [x] One `api-key-row` remains (no second row)
  - [x] Run `make test-docker` and confirm the new tests fail
- [x] Task: Implement rotate route and UI
  - [x] `POST /settings/api-keys/:id/rotate` with CSRF; flash new plaintext once
  - [x] Add `api-key-rotate` and `api-key-last-rotated`
  - [x] Run `make test-docker` and confirm tests pass
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Smoke regression [checkpoint: 7e75b73]

- [x] Task: Run existing smoke and confirm it stays green
  - [x] `make smoke` → `4 passed`
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
