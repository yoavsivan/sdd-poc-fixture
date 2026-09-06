---
description: "Task list for rotate API keys"
---

# Tasks: Rotate API keys

**Input**: Design documents from `/specs/002-rotate-api-keys/`

## Phase 1: Foundational

- [x] T001 Add `rotated_at` in `src/db/migrations/0005_api_keys_rotated_at.sql`
- [x] T002 Extend `ApiKeyRecord` and `rotateApiKey` in `src/api-keys/repo.ts` (same id/name, new hash, set rotated_at)
- [x] T003 Update `test/unit/migrations.test.ts` for 0005

## Phase 2: User Story 1 - Rotate in place (P1)

- [x] T004 [US1] POST `/settings/api-keys/:id/rotate` in `src/http/routes/settings.ts`; one-time plaintext in session
- [x] T005 [US1] Rotate control and last-rotated display in `src/views/settings.ejs`
- [x] T006 [US1] Vitest: rotate keeps id and name, plaintext once, one row

## Phase 3: User Story 2 - Secrets (P1)

- [x] T007 [US2] Vitest: old Bearer 401 exact body; new Bearer 200 without cookie

## Phase 4: User Story 3 - Last rotated (P2)

- [x] T008 [US3] Map `rotated_at` to `api-key-last-rotated` `YYYY-MM-DD` in settings view model
- [x] T009 [US3] Vitest: locator present after rotate

## Phase 5: Polish

- [x] T010 `make test-docker` and `make smoke` (4 passed)

### AC mapping

| F1' criterion | Tasks |
|---|---|
| Rotate keeps id/name, plaintext once | T004–T006 |
| Old 401, new Bearer works | T007 |
| last rotated shown | T008–T009 |
