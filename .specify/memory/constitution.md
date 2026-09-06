<!--
Sync Impact Report
- Version change: (none) → 1.0.0
- Modified principles: placeholders replaced with Shelfmark principles
- Added sections: Brownfield Constraints; Development Workflow
- Removed sections: none (template placeholders filled)
- Follow-up TODOs: none
-->

# Shelfmark Constitution

## Core Principles

### I. Wrap Legacy, Never Rewrite It

`src/legacy/session.cjs` and `src/legacy/query.cjs` MUST remain the
implementations of cookie sessions and SQL building. TypeScript MUST reach
them only through the existing wrappers. A feature MUST NOT rewrite, replace,
or bypass those modules unless a brief explicitly requires it.

Rationale: Shelfmark is a brownfield fixture. Cookie sessions remain how the
UI signs in. Touching the legacy session module for API keys is out of scope
unless a brief says otherwise.

### II. Docker-First Verification (NON-NEGOTIABLE)

The app and every test MUST run in the fixture's containers (`make smoke`,
`make test-docker`). Host Node MUST NOT be used to run the app or tests.
`docker-compose.yml`'s `playwright` service, `playwright.config.ts`, the
Playwright version, and `test/smoke/` MUST stay runnable as they are.

Rationale: Existing smoke (sign-in, add item, tag filter, `/api/items` with
cookie) is the regression floor. A change that cannot keep `make smoke` at
`4 passed` is incomplete.

### III. Least New Surface Area

Implement exactly what the active brief states. Prefer extending the JSON API
and settings UI over new top-level apps or parallel auth stacks. Prefer SQLite
patterns already used in the fixture. No new runtime dependency unless the
brief cannot be met without it. If scope is unclear, take the smaller reading
that still satisfies the brief's acceptance criteria.

Rationale: Team size is 1. No CI. Local Docker and Make targets only.

### IV. Interface Contracts Are Tests

Named `data-testid` locators and HTTP bodies in a brief are the contract.
`GET /api/*` without a valid session or key MUST return status 401 with the
exact body `{"error":"unauthorized"}`. Cookie sessions MUST continue to work
alongside any new Bearer authentication.

Rationale: Acceptance tests locate UI through those test ids and assert the
exact 401 payload. Cosmetic or structural freedom exists only outside that
contract.

### V. TypeScript Strict, Vitest Units, Playwright Smoke

New application code MUST be TypeScript under the existing strict `tsconfig`.
Unit coverage lives in Vitest and MUST run via `make test-docker`. Browser
paths stay in Playwright smoke. Never skip a test to land a change.

Rationale: The fixture already ships forty-five unit cases and four smoke
tests. New work extends that suite rather than replacing it.

## Brownfield Constraints

Tech stack: TypeScript strict, Express, EJS, better-sqlite3, Vitest, Playwright
in Docker. Sign-in for manual and scripted use: username `demo`, password
`demo-pass-1234`. Sessions live in memory and do not survive process restart.

Auth seams that new features MUST use:

- `requireApiUser` in `src/http/middleware/authenticate.ts` for `/api/*`
- `src/http/routes/api.ts` `router.use` so new API routes inherit the guard
- `src/http/routes/settings.ts` and `src/views/settings.ejs` for settings UI
- `src/db/migrations/` next free slot (`0004_…` at constitution time)

Out of scope unless a brief names them: OAuth, per-key scopes, rate limits,
admin UI for other users' keys, cookies-as-keys.

Timestamps in the UI MUST be ISO-8601 dates (`YYYY-MM-DD`); store UTC
internally. Item lists MUST order newest first (same as existing `/items`).

## Development Workflow

Quality gates before a feature is complete:

1. `make test-docker` (Vitest in the app container) passes.
2. `make smoke` still reports `4 passed`.
3. Brief acceptance criteria map to implemented behavior, including
   `data-testid` and HTTP contract.

No CI. Local Docker and Make only. Spec Kit artifacts for a feature live under
`specs/<NNN>-<name>/` plus `.specify/`. Do not edit Spec Kit templates or
protocol files.

## Governance

This constitution supersedes informal practice for work in this repository.
Amendments MUST update version, last-amended date, and a Sync Impact Report
comment. Versioning: MAJOR for incompatible principle removal or redefinition;
MINOR for new or materially expanded principles; PATCH for clarifications.

Compliance review is the author's: before tagging a feature done, confirm
legacy modules are unmodified (unless the brief required a change), smoke is
green, and the brief's interface contract is present in the running app.

**Version**: 1.0.0 | **Ratified**: 2026-09-06 | **Last Amended**: 2026-09-06
