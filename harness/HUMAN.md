# Human decisions

Pre-declared answers for every arm. When a flow stops for a person, look up the matching section below; record the source as `HUMAN.md#<anchor>` in `.trial/decisions.jsonl`.

## project-context

Shelfmark is a small web app for saving links with notes and tags — you paste a URL, add a note and a few tags, and find the link later by tag or by a word in the title. It is the brownfield fixture for this comparison: enough real code to carry project history, deliberately without API-key authentication until F1.

Tech stack as it stands: TypeScript strict, unit tests in Vitest, browser tests in Playwright inside Docker (`make smoke`, `make test-docker`). Wrap `src/legacy/session.cjs` and `src/legacy/query.cjs` through their TypeScript wrappers; do not rewrite those legacy modules. Sign-in for manual and scripted use: username `demo`, password `demo-pass-1234`. Team size 1. No CI — local Docker and Make targets only. No new runtime dependency unless the brief cannot be met without it.

## product

API keys: display format is a short prefix plus a random secret (show prefix and masked tail in the list; show full plaintext once at create). Key length: enough entropy for a bearer secret (at least 32 random bytes before encoding). Settings copy: label the section “API keys”, explain that the secret is shown once, and that revoke is immediate. Item list ordering: newest first (same as existing `/items`). Timestamps in the UI: ISO-8601 date (`YYYY-MM-DD`) for created and last-used; store UTC internally.

## scope

In scope: exactly what the F1 and F1' briefs state — named API keys, Bearer auth on `/api/*`, cookie sessions unchanged, interface contract `data-testid`s and 401 body. Out of scope: anything each brief lists as out of scope (OAuth, per-key scopes, rate limits, admin UI for other users' keys; rotation is F1' only). If unsure, take the smaller reading that still satisfies the brief's acceptance criteria.

## approvals

Plan approval (`approve-plan`): approve if every acceptance criterion in the active brief maps to at least one task or implementation step; otherwise ask the flow to revise once, then approve. Completion approval (`approve-completion`): approve only after the arm's own checks pass (e.g. gate check, smoke, or stock “done” command) and the feature matches the brief. Do not approve completion on partial work.

## clarify

When a menu or clarification offers multiple options, prefer the choice that keeps existing tests green and leaves the legacy session module unmodified unless the brief explicitly requires touching it. Prefer extending the JSON API and settings UI over new top-level apps or parallel auth stacks. Prefer SQLite patterns already used in the fixture.

## defaults

For anything not covered above: choose the option that satisfies the brief's criteria with the least new surface area; never skip a test; never ask the human again — decide, record `source: default` in `.trial/decisions.jsonl`, and continue.

## changelog

2026-09-05T00:00Z · project-context · initial answers · trials already spawned: none
