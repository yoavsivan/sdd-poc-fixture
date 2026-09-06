# Implementation Plan: API-key authentication

**Branch**: `001-api-key-auth` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-api-key-auth/spec.md`

## Summary

Signed-in users create named API keys in Settings. The plaintext secret is shown once. Callers send `Authorization: Bearer <secret>` on `/api/*` with no cookie and act as the owning user. Cookie sessions stay on the legacy session module. Invalid or missing Bearer (when no cookie) returns exact `{"error":"unauthorized"}`. Revoke is immediate; last-used is shown after use.

Technical approach: SQLite `api_keys` table (migration `0004_api_keys.sql`), SHA-256 lookup of the secret via Node `crypto` (no new runtime dependency), Settings HTML section with required `data-testid`s, and Bearer handling only on `/api/*` inside `loadUser` / a small helper so `requireApiUser` stays the 401 gate.

## Technical Context

**Language/Version**: TypeScript 5.7 strict, Node >= 22

**Primary Dependencies**: Existing Express 4, EJS, better-sqlite3. Node `crypto` only. No new runtime packages.

**Storage**: SQLite via existing migrate/exec/query wrappers. New table `api_keys`.

**Testing**: Vitest in `make test-docker`; Playwright smoke via `make smoke` (unchanged `test/smoke/`).

**Target Platform**: Linux Docker Compose app container.

**Project Type**: Single-process server-rendered web app + JSON API.

**Performance Goals**: Bearer lookup is O(1) by hash; one extra UPDATE for last-used per authenticated API request.

**Constraints**: Do not rewrite `src/legacy/session.cjs` or `src/legacy/query.cjs`. Do not change playwright compose service, Playwright version, or `test/smoke/`. Cookie sessions remain for UI. 401 body exact. Interface `data-testid`s exact.

**Scale/Scope**: One user in the fixture; unbounded keys per user is acceptable. Newest-first list.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Wrap legacy, never rewrite: PASS — session.cjs untouched; optional field on SessionData types only; SQL via query.cjs wrappers.
- Docker-first verification: PASS — tests via `make test-docker` / `make smoke`; smoke files unmodified.
- Least new surface: PASS — Settings section + Bearer in existing authenticate middleware; no new app, no new runtime dep.
- Interface contracts are tests: PASS — locators and 401 body in spec/contracts.
- TypeScript strict / Vitest / Playwright: PASS — new unit tests in `test/unit/`.

Post-design re-check: still PASS. No constitution violations. Complexity table empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-api-key-auth/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api-keys-http.md
│   └── settings-ui.md
└── tasks.md
```

### Source Code (repository root)

```text
src/db/migrations/0004_api_keys.sql
src/api-keys/repo.ts
src/api-keys/secret.ts
src/http/middleware/authenticate.ts
src/http/routes/settings.ts
src/views/settings.ejs
src/legacy/session.d.cts          # type-only optional SessionData field
src/public/styles.css             # keys section layout
test/unit/api-keys.test.ts
test/unit/http-auth.test.ts       # extend with Bearer success/fail cases
test/unit/migrations.test.ts      # include 0004
test/unit/views.test.ts           # api-keys-section present
```

**Structure Decision**: Stay in the existing single-project tree. New `src/api-keys/` mirrors `src/users/` and `src/items/`. Auth stays in `authenticate.ts`. Settings UI stays in the existing settings route and template.

## Complexity Tracking

> No constitution violations.
