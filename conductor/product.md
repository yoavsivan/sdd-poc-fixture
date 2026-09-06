# Product Definition

## Title

Shelfmark

## Summary

Shelfmark is a small reading-list web app: a signed-in user pastes a URL, adds a note and a few tags, and later finds the link by tag or by a word in the title. It is a brownfield product with cookie-session sign-in, a server-rendered UI, and a JSON API at `/api/items` that authenticates with the browser session cookie or a named API key (`Authorization: Bearer`).

## Users

- A single seeded operator (`demo` / `demo-pass-1234`) who saves personal links.
- Scripts that currently obtain a `shelfmark.sid` cookie via `scripts/login.sh` before calling the JSON API.

There is no registration, no multi-tenant admin, and no OAuth.

## Current capabilities

- Sign in / sign out with a signed `shelfmark.sid` cookie (in-memory sessions).
- Create, edit, delete, list, and filter saved items (URL, title, optional note, up to ten tags).
- Settings: account details and password change.
- JSON API: `GET/POST /api/items`, `GET/DELETE /api/items/:id`. Writes require `Content-Type: application/json`. Missing session or invalid Bearer returns exactly `{"error":"unauthorized"}`. Named API keys are created in Settings; the secret is shown once; revoke is immediate.
- Health check at `GET /healthz`.

## Product principles

- Cookie sessions remain how the UI signs in; do not replace the legacy session module.
- Prefer extending the existing Settings page and JSON API over new apps or parallel auth stacks.
- Named API keys (when added) are owned by the signed-in user: create in Settings, show the secret once, revoke immediately, rotate in place (same id and name), authenticate `/api/*` as that user via `Authorization: Bearer`.
- Item lists are newest first. Timestamps in the UI are ISO-8601 dates (`YYYY-MM-DD`); store UTC internally.
- Least new surface area; no new runtime dependency unless a brief cannot be met without it.

## Out of scope (product-level)

OAuth, cookies-as-keys, per-key scopes, rate limits, admin UI for other users' keys, and sign-up.
