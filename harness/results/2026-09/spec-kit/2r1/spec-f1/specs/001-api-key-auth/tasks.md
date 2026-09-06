# Tasks: API-key authentication

**Input**: Design documents from `/specs/001-api-key-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests in Vitest (`make test-docker`) covering Bearer, 401 body, Settings locators, last used, and revoke.

**Organization**: Tasks grouped by user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story (US1–US4)

## Phase 1: Setup

**Purpose**: Confirm brownfield layout; no new packages.

- [X] T001 Verify `.gitignore` still ignores `node_modules/`, `data/`, and `*.db`; do not add runtime dependencies to `package.json`

---

## Phase 2: Foundational

**Purpose**: Persistence and secret helpers every story needs.

- [X] T002 Add SQLite migration `src/db/migrations/0004_api_keys.sql` for `api_keys` (id, user_id, name, prefix, secret_hash, created_at, last_used_at, revoked_at)
- [X] T003 [P] Implement secret mint/hash/prefix helpers in `src/apikeys/secret.ts` (≥32 random bytes, SHA-256 hex)
- [X] T004 Implement `src/apikeys/repo.ts` (create, list newest first, find active by hash, touch last used, revoke) using `src/db/exec.ts` and `src/legacy/query.cjs` wrappers only
- [X] T005 Update `test/unit/migrations.test.ts` so a fresh DB applies `0004_api_keys.sql`

**Checkpoint**: Keys can be stored and looked up without HTTP.

---

## Phase 3: User Story 1 - Create a named API key (Priority: P1) 🎯 MVP

**Goal**: Settings create flow with one-time plaintext and listed rows.

**Independent Test**: Sign in, POST a name, see `api-key-plaintext`, GET Settings again without plaintext, row has name and `api-key-created`.

- [X] T006 [US1] Extend `src/http/routes/settings.ts` to list keys on GET and handle `POST /settings/api-keys` (CSRF, trim name, re-render with plaintext)
- [X] T007 [US1] Add “API keys” section to `src/views/settings.ejs` with locators `api-keys-section`, `api-key-name`, `api-key-create`, `api-key-plaintext`, `api-key-row`, `api-key-created`
- [X] T008 [US1] Add unit coverage in `test/unit/api-keys.test.ts` for create, empty name, plaintext once, created date format

---

## Phase 4: User Story 2 - Call the JSON API with the secret (Priority: P1)

**Goal**: Bearer authenticates `/api/*` without a cookie; invalid/missing → exact 401 body.

**Independent Test**: Create item + key; `GET /api/items` with Bearer only returns 200 including the item; `not-a-key` and missing header return `{"error":"unauthorized"}`.

- [X] T009 [US2] Extend `src/http/middleware/authenticate.ts` so `/api/*` with `Authorization: Bearer` uses the key exclusively (touch last used on success)
- [X] T010 [US2] Wire Bearer loading in `src/http/app.ts` if a separate middleware is used (keep `requireApiUser` 401 body unchanged)
- [X] T011 [US2] Add unit tests in `test/unit/api-keys.test.ts` for Bearer 200, missing header 401 exact body, `Bearer not-a-key` 401, Bearer beating cookie

---

## Phase 5: User Story 3 - Cookie sessions still work (Priority: P1)

**Goal**: UI and cookie `/api/items` unchanged.

**Independent Test**: Sign-in cookie still loads `/items` rows and `GET /api/items` 200.

- [X] T012 [US3] Confirm `src/http/middleware/authenticate.ts` cookie path is unchanged for HTML and for `/api/*` without Bearer; add assertion in `test/unit/api-keys.test.ts` that cookie `GET /api/items` is 200

---

## Phase 6: User Story 4 - Last used and immediate revoke (Priority: P2)

**Goal**: Show last used after Bearer use; revoke is immediate.

**Independent Test**: After Bearer GET, Settings shows `api-key-last-used`; revoke; same secret 401.

- [X] T013 [US4] Add revoke `POST /settings/api-keys/:id/revoke` in `src/http/routes/settings.ts` and `api-key-revoke` / `api-key-last-used` in `src/views/settings.ejs`
- [X] T014 [US4] Style the keys section in `src/public/styles.css` without changing smoke layout elsewhere
- [X] T015 [US4] Unit tests in `test/unit/api-keys.test.ts` for last-used after Bearer use and revoke → 401 exact body

---

## Phase 7: Polish

- [X] T016 Run `make test-docker` and `make smoke`; existing smoke must report `4 passed`
- [X] T017 Update Settings copy so “API keys” explains the secret is shown once and revoke is immediate (`src/views/settings.ejs`)

## Dependencies

- Phase 2 before US1–US4
- US1 before US2 (need a secret)
- US2 before US4 (last used requires Bearer)
- US3 can follow US2 (cookie regression)

## Implementation strategy

MVP = T001–T011 (create + Bearer). Then cookie regression, then revoke/last-used, then gates.
