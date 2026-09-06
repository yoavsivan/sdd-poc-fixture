# Implementation Plan: Named API keys (F1)

TDD per `conductor/workflow.md`: failing tests before implementation, then
`make test-docker` (never host Node). Phase checkpoints follow the workflow
verification protocol.

## Phase 1: Persist named API keys [checkpoint: 387f7d8]

- [x] Task: Write failing tests for API-key storage 387f7d8
  - [x] Add Vitest coverage for migration `0004` creating `api_keys`
  - [x] Add repo tests: create named key (plaintext returned once, hash stored), list newest first, lookup by secret, revoke
- [x] Task: Implement SQLite schema and keys repository 387f7d8
  - [x] Add `src/db/migrations/0004_api_keys.sql` (id, user_id, name, prefix, secret_hash, created_at, last_used_at, revoked_at)
  - [x] Add `src/api-keys/secret.ts` (32+ random bytes, prefix + secret display format, SHA-256 lookup hash)
  - [x] Add `src/api-keys/repo.ts` wrapping `query.cjs` via `db/exec.ts`
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) 387f7d8

## Phase 2: Bearer auth on `/api/*` [checkpoint: 387f7d8]

- [x] Task: Write failing tests for Bearer and cookie auth 387f7d8
  - [x] Valid Bearer, no cookie: `GET /api/items` → 200 `{ items, count }`
  - [x] Missing header and `Authorization: Bearer not-a-key` → 401 exact `{"error":"unauthorized"}`
  - [x] Cookie session still authenticates `GET /api/items`
  - [x] Successful Bearer use stamps `last_used_at`
- [x] Task: Authenticate `/api/*` with Bearer without touching legacy sessions 387f7d8
  - [x] Extend API middleware so Bearer secret resolves to the owning user
  - [x] Keep `loadUser` cookie path unchanged for the UI
  - [x] Update `last_used_at` on successful key auth
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) 387f7d8

## Phase 3: Settings UI — create, list, revoke [checkpoint: 387f7d8]

- [x] Task: Write failing tests for Settings API keys 387f7d8
  - [x] GET `/settings` includes `api-keys-section` and empty-state-safe markup
  - [x] POST create with name shows `api-key-plaintext` once; subsequent GET hides it
  - [x] Row has `api-key-row`, name, `api-key-created` (`YYYY-MM-DD`)
  - [x] Revoke then Bearer of that secret → 401 `{"error":"unauthorized"}`
  - [x] Last used renders `api-key-last-used` after a Bearer call
- [x] Task: Settings section and routes 387f7d8
  - [x] Add `api-keys-section` to `src/views/settings.ejs` with contracted `data-testid`s
  - [x] POST `/settings/api-keys` (CSRF) creates a key; stash plaintext in session for one render
  - [x] POST `/settings/api-keys/:id/revoke` (CSRF) revokes immediately
  - [x] Copy: label “API keys”; secret shown once; revoke is immediate
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) 387f7d8

## Phase 4: Quality gate [checkpoint: 387f7d8]

- [x] Task: Run container checks 387f7d8
  - [x] `make test-docker` (54 passed)
  - [x] `make smoke` (existing four tests stay green)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) 387f7d8
