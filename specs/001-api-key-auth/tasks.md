---
description: "Task list for API-key authentication"
---

# Tasks: API-key authentication

**Input**: Design documents from `/specs/001-api-key-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Vitest in `test/unit/` via `make test-docker`. Do not modify `test/smoke/`.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

**Purpose**: Shared files for keys

- [x] T001 Create `src/api-keys/` and migration slot `src/db/migrations/0004_api_keys.sql`
- [x] T002 Extend `SessionData` in `src/legacy/session.d.cts` with optional `apiKeyPlaintext?: string` (types only; do not rewrite session.cjs)

---

## Phase 2: Foundational

**Purpose**: Persist keys and mint secrets. Blocks all stories.

- [x] T003 Create `api_keys` table in `src/db/migrations/0004_api_keys.sql` (id, user_id, name, prefix, suffix, token_hash UNIQUE, created_at, last_used_at, revoked_at)
- [x] T004 [P] Implement secret mint/hash/mask in `src/api-keys/secret.ts` (≥32 random bytes, `smk_<prefix>_<body>`, sha256 hex, masked tail)
- [x] T005 Implement `src/api-keys/repo.ts` (create, list active newest-first, findByTokenHash, touchLastUsed, revoke)
- [x] T006 Update `test/unit/migrations.test.ts` so fresh DB applies `0004_api_keys.sql`

**Checkpoint**: Migration + repo exist; no HTTP yet

---

## Phase 3: User Story 1 - Create a named API key (P1) 🎯 MVP

**Goal**: Settings create named keys; plaintext once; row with name and created date.

**Independent Test**: Sign in, POST create, see `api-key-plaintext`, reload hides it, `api-key-row` still listed.

**AC**: F1 #1, #2; locators section/name/create/plaintext/row/created; Settings copy.

- [x] T007 [P] [US1] Add Vitest coverage in `test/unit/api-keys.test.ts` for mint format/entropy and repo create+list
- [x] T008 [US1] Add API keys section to `src/views/settings.ejs` (`api-keys-section`, name, create, row, created, copy “API keys” / shown once / revoke immediate)
- [x] T009 [US1] POST `/settings/api-keys` in `src/http/routes/settings.ts` (CSRF, trim name, one-time session plaintext, redirect)
- [x] T010 [US1] GET `/settings` lists keys newest first and shows plaintext only when `session.data.apiKeyPlaintext` is set then clears it
- [x] T011 [US1] Minimal styles in `src/public/styles.css` for key rows
- [x] T012 [US1] Extend `test/unit/views.test.ts` for `api-keys-section`; add HTTP tests for create/reload hide plaintext

**Checkpoint**: US1 independently testable in Vitest

---

## Phase 4: User Story 2 - Call JSON API with the secret (P1)

**Goal**: Bearer on `/api/*` without cookie; cookie sessions still work.

**Independent Test**: Create item + key; `GET /api/items` with Bearer only → 200 items+count including the item; cookie GET still 200.

**AC**: F1 #3, #5.

- [x] T013 [US2] In `src/http/middleware/authenticate.ts`, on `/api/*` if Bearer present: lookup hash, load owner, ignore cookie; else existing session loadUser
- [x] T014 [US2] Add Vitest: Bearer 200 without cookie includes UI-created item; cookie GET `/api/items` still 200

**Checkpoint**: Scripts can authenticate; browsers unchanged

---

## Phase 5: User Story 3 - Reject invalid callers (P1)

**Goal**: Missing header or `Bearer not-a-key` → 401 exact body. Invalid Bearer wins over cookie.

**AC**: F1 #4.

- [x] T015 [US3] Keep `requireApiUser` 401 `{"error":"unauthorized"}`; Bearer present but unknown/malformed unsets user
- [x] T016 [US3] Vitest: no header and `Bearer not-a-key` → 401 exact text `{"error":"unauthorized"}`; invalid Bearer + valid cookie still 401

**Checkpoint**: Existing 401 contract preserved and extended

---

## Phase 6: User Story 4 - Last used and revoke (P2)

**Goal**: last-used after use; revoke immediate 401.

**AC**: F1 #6; locators last-used and revoke.

- [x] T017 [US4] Touch `last_used_at` on successful Bearer auth; show `api-key-last-used` as `YYYY-MM-DD`
- [x] T018 [US4] POST `/settings/api-keys/:id/revoke` with `api-key-revoke`; revoked secret 401 exact body
- [x] T019 [US4] Vitest: last-used appears after Bearer GET; revoke then same secret 401

**Checkpoint**: All F1 acceptance criteria mapped

---

## Phase 7: Polish

- [x] T020 Run `make test-docker` and `make smoke`; smoke remains `4 passed`
- [x] T021 Confirm `src/legacy/session.cjs` and `src/legacy/query.cjs` unmodified

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 → US2 → US3 → US4 → Polish
- US2 depends on US1 (needs a key)
- US3 depends on US2 (Bearer path)
- US4 depends on US2 (use then last-used/revoke)

### AC mapping

| F1 criterion | Tasks |
|---|---|
| Create named key, plaintext once, reload hides | T008–T012 |
| Row name + created timestamp | T008, T010 |
| Bearer GET /api/items 200 items+count including UI item | T013–T014 |
| Missing / not-a-key 401 exact body | T015–T016 |
| Cookie sessions still work | T014, T020 |
| Last used + revoke immediate 401 | T017–T019 |

---

## Implementation Strategy

Implement sequentially on `trial/spec-kit/1`. Do not create a separate git feature branch. Validate with `make test-docker` then `make smoke`.
