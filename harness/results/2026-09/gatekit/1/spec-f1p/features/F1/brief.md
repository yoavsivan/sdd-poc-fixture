# F1 — API-key authentication

Written 2026-09-06 by the planner. The executor implements against this file; `gatekit drift` checks
that every route and UI control the code adds is named here.

## Intent

A signed-in user of Shelfmark can create a named API key in Settings and use it as a Bearer token so
the JSON API authenticates without a cookie. Today `GET /api/items` only accepts the browser session
cookie. F1 adds named keys: the secret is shown once at create, listed with a prefix and masked tail,
and sent as `Authorization: Bearer` (`header:authorization-bearer`) on `/api/*`. Cookie sessions stay
how the UI signs in.

## Acceptance criteria

1. From Settings, the user creates a named API key (`api-keys-section`, `api-key-name`,
   `api-key-create`). After `POST /api-keys`, the one-time plaintext (`api-key-plaintext`) is a
   non-empty secret (short prefix plus at least 32 random bytes, encoded). Reloading Settings hides
   that plaintext.
2. An `api-key-row` lists the name, a created timestamp (`api-key-created`) as an ISO-8601 date
   `YYYY-MM-DD`, and a prefix plus masked tail. Newest keys first (same as `/items`).
3. `GET /api/items` with `Authorization: Bearer` and the secret returns 200 with `items` and `count`,
   including an item the user created in the UI. No cookie is required.
4. Missing header, or `Authorization: Bearer not-a-key`, returns 401 with the exact body
   `{"error":"unauthorized"}`.
5. Cookie sessions still work: the signed-in browser can `GET /api/items` and `/items` still renders
   item rows.
6. After the key is used, last used is shown (`api-key-last-used`, ISO-8601 date). Revoke
   (`api-key-revoke`, `POST /api-keys/:id/revoke`) is immediate: the same secret then returns 401
   with the exact body `{"error":"unauthorized"}`. Create and revoke forms include the existing CSRF
   field `_csrf`.

Settings copy labels the section “API keys”, explains that the secret is shown once, and that revoke
is immediate. Timestamps are stored UTC internally.

## Out of scope

OAuth, cookies-as-keys, per-key scopes, rate limits, admin UI for other users' keys, per-key
read-only scope, multiple concurrent secrets, and renaming a key.

## Follow-up: rotate keys

A user replaces a leaked secret without creating a second row. `POST /api-keys/:id/rotate`
(`api-key-rotate`) keeps the same id and name, mints a new secret shown once (`api-key-plaintext`),
and retires the old secret immediately (401 `{"error":"unauthorized"}` on `Authorization: Bearer`).
The new secret works on `Authorization: Bearer`. After rotation, last rotated is shown
(`api-key-last-rotated`) as an ISO-8601 date `YYYY-MM-DD`.
