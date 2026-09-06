# Plan: Named API keys for the JSON API

TDD per `conductor/workflow.md`. Every task writes failing tests before implementation. Verification uses `make test-docker` (not the host Node toolchain). Each phase ends with a Workflow checkpoint.

## Phase 1: Persist named API keys [checkpoint: c78d733]

- [x] Task: Write failing tests for API key storage 1b7f863
  - [x] Add unit tests that expect migration `0004_api_keys.sql` to create an `api_keys` table
  - [x] Add repo tests: create named key (hash stored, plaintext returned once), list newest first, lookup by secret, revoke removes the secret, last-used starts empty
  - [x] Run `make test-docker` and confirm the new tests fail
- [x] Task: Implement API key persistence c78d733
  - [x] Add `src/db/migrations/0004_api_keys.sql` (user_id FK, name, prefix, last4, secret_hash, created_at, last_used_at)
  - [x] Add `src/apikeys/` repo wrapping `src/legacy/query.cjs` via `src/db/exec.ts`
  - [x] Generate ≥32 random bytes before encoding; secret format is a short prefix plus the encoded secret
  - [x] Store SHA-256 of the plaintext; never persist the secret
  - [x] Run `make test-docker` and confirm tests pass
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) c78d733

## Phase 2: Bearer authentication on `/api/*` [checkpoint: 26699c3]

Maps to AC 3, 4, 5.

- [x] Task: Write failing tests for Bearer auth 83dee6e
  - [x] `GET /api/items` with `Authorization: Bearer <valid secret>` and no cookie → 200 `{ items, count }` including an item created via the API/UI as that user
  - [x] Missing header → 401 exact body `{"error":"unauthorized"}`
  - [x] `Authorization: Bearer not-a-key` → 401 exact body
  - [x] Signed-in cookie without Bearer still returns 200 on `GET /api/items`
  - [x] Existing cases (tampered cookie, `Bearer anything`) stay 401
  - [x] Run `make test-docker` and confirm the new tests fail
- [x] Task: Implement Bearer on the existing API guard 26699c3
  - [x] Extend `src/http/middleware/authenticate.ts` so `loadUser` accepts a valid Bearer secret after the cookie session path
  - [x] On successful key auth, set `res.locals.user` to the owning user and stamp `last_used_at` (UTC)
  - [x] Do not modify `src/legacy/session.cjs`
  - [x] Run `make test-docker` and confirm tests pass
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) 26699c3

## Phase 3: Settings create, list, last-used, and revoke

Maps to AC 1, 2, 6.

- [ ] Task: Write failing tests for the Settings API-key UI
  - [ ] Signed-in `GET /settings` includes `api-keys-section`, name field, create button
  - [ ] `POST` create with a name shows non-empty `api-key-plaintext` and an `api-key-row` with name and `api-key-created` (`YYYY-MM-DD`)
  - [ ] A subsequent `GET /settings` hides `api-key-plaintext` and still lists the row (prefix + masked tail, not the full secret)
  - [ ] After a Bearer `GET /api/items`, Settings shows `api-key-last-used` as `YYYY-MM-DD`
  - [ ] Revoke then the same secret returns 401 `{"error":"unauthorized"}`
  - [ ] Run `make test-docker` and confirm the new tests fail
- [ ] Task: Implement Settings section and routes
  - [ ] Extend `src/views/settings.ejs` with the contract `data-testid`s and copy (“API keys”, shown once, revoke immediate)
  - [ ] Extend `src/http/routes/settings.ts` for create and revoke (cookie session + CSRF)
  - [ ] One-time plaintext via session flash; list newest first
  - [ ] Run `make test-docker` and confirm tests pass
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Smoke regression

- [ ] Task: Run existing smoke and confirm it stays green
  - [ ] Run `make smoke` without changing `docker-compose.yml` playwright service, Playwright version, or `test/smoke/`
  - [ ] Confirm `4 passed`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
