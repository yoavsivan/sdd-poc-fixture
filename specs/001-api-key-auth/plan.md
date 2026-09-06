# Implementation Plan: API-key authentication

**Branch**: `001-api-key-auth` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-api-key-auth/spec.md`

## Summary

Signed-in users mint named API keys in Settings and authenticate `/api/*` with `Authorization: Bearer` and no cookie. Cookie sessions stay for the UI. Persist keys in SQLite (`0004_api_keys.sql`), hash secrets with Node `crypto`, extend `loadUser` for Bearer on `/api/*` only, and add Settings create/revoke with the brief's `data-testid`s.

## Technical Context

**Language/Version**: TypeScript 5.7 strict, Node 22

**Primary Dependencies**: Express 4, better-sqlite3, EJS (existing). No new runtime dependency. Node `crypto` for secret bytes and SHA-256.

**Storage**: SQLite via existing migrations (`src/db/migrations/0004_api_keys.sql`)

**Testing**: Vitest in Docker (`make test-docker`); Playwright smoke (`make smoke`) must stay `4 passed`

**Target Platform**: Linux server in Docker Compose

**Project Type**: Single-project server-rendered web app + JSON API

**Performance Goals**: Settings and `/api/items` remain interactive for a single-user fixture

**Constraints**: Do not rewrite `src/legacy/session.cjs` or `src/legacy/query.cjs`. Do not change playwright Compose service, Playwright version, or `test/smoke/`. Loc budget via `make loc`.

**Scale/Scope**: One seeded user; multiple named keys per user; no OAuth, scopes, rate limits, or rotation (F1')

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Wrap legacy, do not rewrite: PASS — session/query untouched; Bearer added beside cookie in TypeScript middleware.
- Smallest surface: PASS — Settings section + Bearer on `/api/*` + one migration. No new runtime deps.
- Existing smoke stays green: PASS — cookie path unchanged; smoke files unmodified.
- Observable contracts: PASS — all listed `data-testid`s and exact 401 body.
- TypeScript/SQLite/least magic: PASS — `0004_…`, newest-first, UTC stored, `YYYY-MM-DD` in UI.

Post-design: still PASS. No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-api-key-auth/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api-keys.md
└── tasks.md
```

### Source Code (repository root)

```text
src/db/migrations/0004_api_keys.sql
src/apikeys/secret.ts
src/apikeys/repo.ts
src/http/middleware/authenticate.ts
src/http/routes/settings.ts
src/views/settings.ejs
src/public/styles.css
test/unit/api-keys.test.ts
test/unit/migrations.test.ts
```

**Structure Decision**: Stay in the existing single-project layout. New `src/apikeys/` mirrors `src/users/` and `src/items/`. Auth remains in `authenticate.ts`. Settings HTML stays in `settings.ejs`.

## Complexity Tracking

> No constitution violations.
