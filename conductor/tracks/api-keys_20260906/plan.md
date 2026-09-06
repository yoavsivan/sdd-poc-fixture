# Implementation Plan: Named API keys (F1)

TDD per `conductor/workflow.md`: failing tests before implementation, then
`make test-docker` (never host Node). Phase checkpoints follow the workflow
verification protocol.

## Phase 1: Persist named API keys

- [ ] Task: Write failing tests for API-key storage
  - [ ] Add Vitest coverage for migration `0004` creating `api_keys`
  - [ ] Add repo tests: create named key (plaintext returned once, hash stored), list newest first, lookup by secret, revoke
- [ ] Task: Implement SQLite schema and keys repository
  - [ ] Add `src/db/migrations/0004_api_keys.sql` (id, user_id, name, prefix, secret_hash, created_at, last_used_at, revoked_at)
  - [ ] Add `src/api-keys/secret.ts` (32+ random bytes, prefix + secret display format, SHA-256 lookup hash)
  - [ ] Add `src/api-keys/repo.ts` wrapping `query.cjs` via `db/exec.ts`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Bearer auth on `/api/*`

- [ ] Task: Write failing tests for Bearer and cookie auth
  - [ ] Valid Bearer, no cookie: `GET /api/items` → 200 `{ items, count }`
  - [ ] Missing header and `Authorization: Bearer not-a-key` → 401 exact `{"error":"unauthorized"}`
  - [ ] Cookie session still authenticates `GET /api/items`
  - [ ] Successful Bearer use stamps `last_used_at`
- [ ] Task: Authenticate `/api/*` with Bearer without touching legacy sessions
  - [ ] Extend API middleware so Bearer secret resolves to the owning user
  - [ ] Keep `loadUser` cookie path unchanged for the UI
  - [ ] Update `last_used_at` on successful key auth
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Settings UI — create, list, revoke

- [ ] Task: Write failing tests for Settings API keys
  - [ ] GET `/settings` includes `api-keys-section` and empty-state-safe markup
  - [ ] POST create with name shows `api-key-plaintext` once; subsequent GET hides it
  - [ ] Row has `api-key-row`, name, `api-key-created` (`YYYY-MM-DD`)
  - [ ] Revoke then Bearer of that secret → 401 `{"error":"unauthorized"}`
  - [ ] Last used renders `api-key-last-used` after a Bearer call
- [ ] Task: Settings section and routes
  - [ ] Add `api-keys-section` to `src/views/settings.ejs` with contracted `data-testid`s
  - [ ] POST `/settings/api-keys` (CSRF) creates a key; stash plaintext in session for one render
  - [ ] POST `/settings/api-keys/:id/revoke` (CSRF) revokes immediately
  - [ ] Copy: label “API keys”; secret shown once; revoke is immediate
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Quality gate

- [ ] Task: Run container checks
  - [ ] `make test-docker`
  - [ ] `make smoke` (existing four tests stay green)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
