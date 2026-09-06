# Implementation Plan: Rotate API keys

**Branch**: `002-rotate-api-keys` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-rotate-api-keys/spec.md`

## Summary

Add Rotate on each API key row. Keep id and name, replace the stored secret hash, show the new plaintext once, retire the old secret immediately, and display last rotated as `YYYY-MM-DD`.

## Technical Context

**Language/Version**: TypeScript 5.7 strict, Node 22

**Primary Dependencies**: Existing Express/SQLite/EJS. No new runtime dependency.

**Storage**: SQLite `ALTER TABLE api_keys ADD COLUMN last_rotated_at` via `0005_api_keys_rotated.sql`

**Testing**: Vitest in Docker; smoke must stay `4 passed`

**Target Platform**: Linux / Docker Compose

**Project Type**: Single-project web app

**Performance Goals**: Same as F1

**Constraints**: Do not rewrite legacy session/query. Do not change Playwright smoke. Rotation must not create a second row.

**Scale/Scope**: One rotate control per key; no concurrent secrets; no rename.

## Constitution Check

- Wrap legacy: PASS
- Smallest surface: PASS — one migration, repo rotate, Settings POST + locators
- Smoke green: PASS — cookie path untouched
- Observable contracts: PASS — `api-key-rotate`, `api-key-last-rotated`
- SQLite patterns: PASS — `0005_…`, UTC in DB, date in UI

Post-design: PASS.

## Project Structure

```text
src/db/migrations/0005_api_keys_rotated.sql
src/apikeys/repo.ts          # rotateApiKey
src/http/routes/settings.ts  # POST /settings/api-keys/:id/rotate
src/views/settings.ejs       # rotate button + last rotated
test/unit/api-keys.test.ts   # rotate cases
test/unit/migrations.test.ts
```

**Structure Decision**: Extend F1 modules in place; no parallel auth stack.

## Complexity Tracking

> No constitution violations.
