# Tasks: Rotate API keys

**Input**: Design documents from `/specs/002-rotate-api-keys/`

**Prerequisites**: plan.md, spec.md (F1 already shipped)

## Phase 1: Foundational

- [X] T001 Add `src/db/migrations/0005_api_keys_rotated.sql` (`last_rotated_at`)
- [X] T002 Update `test/unit/migrations.test.ts` for `0005_api_keys_rotated.sql`

## Phase 2: User Story 1 - Rotate in place (P1)

- [X] T003 [US1] Implement `rotateApiKey` in `src/apikeys/repo.ts` (same id/name, new hash/prefix/tail, set last_rotated_at)
- [X] T004 [US1] Add `POST /settings/api-keys/:id/rotate` in `src/http/routes/settings.ts` re-rendering with plaintext
- [X] T005 [US1] Add `api-key-rotate` in `src/views/settings.ejs`

## Phase 3: User Story 2 - Old secret dies (P1)

- [X] T006 [US2] Unit tests in `test/unit/api-keys.test.ts`: old Bearer 401 exact body, new Bearer 200, still one row

## Phase 4: User Story 3 - Last rotated (P2)

- [X] T007 [US3] Show `api-key-last-rotated` in `src/views/settings.ejs` after rotation
- [X] T008 [US3] Assert last rotated `YYYY-MM-DD` in `test/unit/api-keys.test.ts`

## Phase 5: Polish

- [X] T009 Run `make test-docker` and `make smoke` (`4 passed`)

## Dependencies

T001–T002 before stories. T003–T005 before T006–T008.
