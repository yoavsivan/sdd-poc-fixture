# F1 — API-key authentication

Written 2026-09-06 by the planner. The executor implements against this file; `gatekit drift` checks
that every route and UI control the code adds is named here.

## Intent

A signed-in user of Shelfmark can create a named API key in Settings and use it as a Bearer token so
the JSON API authenticates without a cookie. F1 added named API keys; F1' adds Rotate so a leaked
secret can be replaced without a second row. Cookie sessions stay how the UI signs in.

## Acceptance criteria

- From Settings (`GET /settings`), the user can create a named API key. The create form uses
  `api-key-name` (the `name` attribute is `api-key-name`) and `api-key-create`. After create, the
  one-time plaintext at `api-key-plaintext` is a non-empty secret. Reloading Settings hides that
  plaintext.
- An `api-key-row` lists the name and a created timestamp at `api-key-created` (ISO-8601 date
  `YYYY-MM-DD`; stored UTC internally). The list shows a short prefix plus a masked tail. Newest
  keys first, same as `/items`.
- `GET /api/items` with `Authorization: Bearer` (`header:authorization-bearer`) and the secret
  returns 200 with `items` and `count`, and includes an item the user created in the UI. No cookie
  is required. The key authenticates `/api/*` as the owning user.
- Missing header, or `Authorization: Bearer not-a-key`, returns 401 with the exact body
  `{"error":"unauthorized"}`.
- Cookie sessions still work: the signed-in browser can `GET /api/items` and `GET /items` still
  renders item rows.
- After the key is used, last used is shown at `api-key-last-used` (`YYYY-MM-DD`). Revoke via
  `api-key-revoke` is immediate: the same secret then returns 401 with the exact body.
- Settings keys section `api-keys-section` is labelled “API keys”, explains that the secret is
  shown once, and that revoke is immediate.
- Create posts to `POST /api-keys` (mounted as `POST /settings/api-keys`). Revoke posts to
  `POST /api-keys/:id/revoke` (mounted as `POST /settings/api-keys/:id/revoke`). Both forms
  include the existing `_csrf` hidden field used by the rest of Settings.
- Rotate via `api-key-rotate` keeps the same key id and name, mints a new secret, and shows it
  once at `api-key-plaintext`. `POST /api-keys/:id/rotate` (mounted as
  `POST /settings/api-keys/:id/rotate`) includes `_csrf`. The old secret then returns 401
  `{"error":"unauthorized"}`; the new secret works on `Authorization: Bearer`. After rotation,
  last rotated is shown at `api-key-last-rotated` (`YYYY-MM-DD`).

## Out of scope

OAuth, cookies-as-keys, per-key scopes, rate limits, admin UI for other users' keys, per-key
read-only scope, multiple concurrent secrets, renaming a key.
