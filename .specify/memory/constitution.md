<!--
Sync Impact Report
- Version change: (none) → 1.0.0
- Modified principles: initial adoption (placeholders → Shelfmark principles)
- Added sections: Brownfield Constraints; Quality Gates
- Removed sections: none
- Follow-up TODOs: none
-->

# Shelfmark Constitution

## Core Principles

### I. Wrap Legacy, Do Not Rewrite It
`src/legacy/session.cjs` and `src/legacy/query.cjs` are the brownfield
corners of this app. New work MUST reach them only through their existing
TypeScript wrappers. Cookie sessions remain how the UI signs in. A feature
MUST NOT replace, fork, or rewrite those modules unless a ratified brief
explicitly requires it.

**Rationale**: The fixture exists to practice change beside history, not to
erase it. Rewriting session or query would invalidate the comparison.

### II. Smallest Surface That Meets the Brief
Ship exactly the named acceptance criteria. MUST NOT add OAuth, per-key
scopes, rate limits, admin UI for other users' keys, or a second auth stack
unless the active brief requires it. MUST NOT add a new runtime dependency
unless the brief cannot be met without it. Prefer extending the JSON API and
Settings UI over new top-level apps.

**Rationale**: Extra surface area is out of scope by default and competes
with the loc budget and the existing smoke.

### III. Existing Smoke Stays Green (NON-NEGOTIABLE)
Sign-in, add item, tag filter, and `GET /api/items` with a cookie MUST keep
passing. MUST NOT change the `playwright` Compose service, Playwright
version, or `test/smoke/`. App and tests run in the fixture containers
(`make smoke`, `make test-docker`), not the host Node toolchain for those
gates.

**Rationale**: The harness later scores this tree against frozen smoke and
acceptance locators. Breaking the baseline fails the trial.

### IV. Observable Contracts Over Internal Shape
User-visible locators (`data-testid`) and HTTP contracts in the brief
(Bearer header, exact `{"error":"unauthorized"}` body) are the acceptance
surface. Routes, storage, and module layout may vary; those locators and
status bodies MUST match the brief.

**Rationale**: Hidden tests locate the UI and HTTP by those identifiers, not
by internal class names.

### V. TypeScript Strict, SQLite, Least Magic
Stay on TypeScript strict, Vitest unit tests, Playwright in Docker, and
SQLite migrations already used by the fixture. Next migration slot is
`0004_…`. Item and key lists show newest first. Timestamps are stored UTC
and shown as ISO-8601 dates (`YYYY-MM-DD`) in the UI.

**Rationale**: Matching existing patterns keeps the tree readable and avoids
a parallel persistence style.

## Brownfield Constraints

- Team size 1. No CI. Local Docker and Make targets only.
- Seeded sign-in: username `demo`, password `demo-pass-1234`.
- Settings copy for keys MUST label the section “API keys”, explain that the
  secret is shown once, and that revoke is immediate.
- API key plaintext is a short prefix plus a random secret with at least 32
  random bytes before encoding. The list shows prefix and a masked tail; the
  full secret is shown once at create.

## Quality Gates

- `make smoke` MUST report `4 passed` after the change.
- Unit coverage for new auth and settings paths MUST run via
  `make test-docker`.
- Do not skip tests. Partial completion is not done.

## Governance

This constitution supersedes informal practice for work in this repository.
Amendments MUST bump the version (MAJOR for incompatible principle changes,
MINOR for new principles, PATCH for wording). Compliance is reviewed when
planning and again before marking a feature complete. Unjustified complexity
or new runtime dependencies fail the constitution check unless the brief
cannot be met otherwise.

**Version**: 1.0.0 | **Ratified**: 2026-09-06 | **Last Amended**: 2026-09-06
