# Implementation Plan: Rotate API keys

**Branch**: `002-rotate-api-keys` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-rotate-api-keys/spec.md`

## Summary

Add Rotate on each Settings API key row. Same id and name; new secret shown once; old Bearer value 401 immediately; last rotated date shown. Reuse F1 mint/hash, session one-time plaintext, and Bearer lookup.

## Technical Context

**Language/Version**: TypeScript 5.7 strict, Node >= 22

**Primary Dependencies**: Existing Express, EJS, better-sqlite3, Node crypto. No new runtime packages.

**Storage**: SQLite. Migration `0005_api_keys_rotated_at.sql` adds `rotated_at TEXT`.

**Testing**: Vitest `make test-docker`; `make smoke` unchanged.

**Target Platform**: Docker Compose app container.

**Project Type**: Single-process web app + JSON API.

**Performance Goals**: One UPDATE replacing hash/prefix/suffix/rotated_at.

**Constraints**: Wrap legacy, do not rewrite session.cjs/query.cjs. Do not change playwright service or `test/smoke/`. No second row, no concurrent secrets.

**Scale/Scope**: One rotate control per active key.

## Constitution Check

- Wrap legacy: PASS — repo update via query.cjs wrappers.
- Docker-first: PASS — test-docker + smoke.
- Least surface: PASS — one column, one POST, two testids.
- Interface contract: PASS — `api-key-rotate`, `api-key-last-rotated`.
- TypeScript/Vitest: PASS.

Post-design: PASS. No violations.

## Project Structure

```text
specs/002-rotate-api-keys/
src/db/migrations/0005_api_keys_rotated_at.sql
src/api-keys/repo.ts          # rotateApiKey
src/http/routes/settings.ts   # POST /settings/api-keys/:id/rotate
src/views/settings.ejs
test/unit/api-keys.test.ts
test/unit/migrations.test.ts
```

**Structure Decision**: Extend F1 files; no new package.

## Complexity Tracking

> None.
