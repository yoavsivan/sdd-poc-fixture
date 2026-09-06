# F1 — API-key authentication

Written 2026-09-06 by the planner. The executor implements against this file; `gatekit drift` checks
that every route and UI control the code adds is named here.

## Intent

A signed-in user of Shelfmark can create a named API key in Settings and use it as a Bearer token
so that the JSON API authenticates without a cookie. Today `GET /api/items` only accepts the
browser session cookie. F1 adds API keys so a script can call `/api/*` as that user.

## Acceptance criteria

Prose, one criterion per bullet, each observable from outside the code. Routes are named as
`METHOD /path` and controls by their identifier so `gatekit drift` can match them.

- From Settings, the user creates a named API key with `api-key-name` and `api-key-create` inside
  `api-keys-section`. `POST /api-keys` mints the key. After create, `api-key-plaintext` shows a
  non-empty secret once (prefix plus random secret, at least 32 random bytes before encoding).
  Reloading Settings hides that plaintext.
- An `api-key-row` lists the name, a short prefix with a masked tail, and `api-key-created` as an
  ISO-8601 date (`YYYY-MM-DD`). Keys are listed newest first, same as `/items`.
- `GET /api/items` with `Authorization: Bearer <key>` (identifier `header:authorization-bearer`)
  and the secret returns 200 with `items` and `count`, including an item the user created in the
  UI. No cookie is required. Cookie sessions still work on `GET /api/items` and `/items`.
- Missing `Authorization` header, or `Authorization: Bearer not-a-key`, returns 401 with the
  exact body `{"error":"unauthorized"}`.
- After the key is used, `api-key-last-used` shows the UTC last-used time as `YYYY-MM-DD`.
- Revoke via `api-key-revoke` (`POST /api-keys/:id/revoke`) is immediate: the same secret then
  returns 401 with the exact body `{"error":"unauthorized"}`.
- Settings copy labels the section “API keys”, explains that the secret is shown once, and that
  revoke is immediate.

## Out of scope

OAuth, cookies-as-keys, per-key scopes, rate limits, admin UI for other users' keys, rotating a
key (that is F1'). Do not replace the legacy session module. Do not change the playwright compose
service, Playwright version, or `test/smoke/`.
