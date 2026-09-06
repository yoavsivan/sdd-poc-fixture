# Spec: Named API keys for the JSON API

## Overview

A signed-in Shelfmark user can create a named API key in Settings and use the shown secret as `Authorization: Bearer` so that `/api/*` authenticates as that user without a cookie. Cookie sessions remain how the UI signs in. The plaintext secret is shown once at create time; the list shows a prefix and masked tail. Revoke is immediate.

## Functional Requirements

1. From Settings, the user can create a named API key.
2. After create, Settings shows a non-empty plaintext secret once (`api-key-plaintext`). Reloading Settings hides that plaintext.
3. Each listed key is an `api-key-row` that shows the name and a created timestamp (`api-key-created`) as an ISO-8601 date (`YYYY-MM-DD`).
4. Listed keys are newest first (same as `/items`). The list shows a short prefix plus a masked tail, never the full secret after the create response.
5. `GET /api/items` with `Authorization: Bearer <secret>` and no cookie returns 200 with `items` and `count`, including items the user created in the UI.
6. Missing `Authorization` header, or `Authorization: Bearer not-a-key`, returns 401 with the exact body `{"error":"unauthorized"}`.
7. Cookie sessions still work: a signed-in browser can `GET /api/items` and `/items` still renders item rows.
8. After the key is used on `/api/*`, last used is shown (`api-key-last-used`) as `YYYY-MM-DD`.
9. Revoke (`api-key-revoke`) is immediate: the same secret then returns 401 with the exact body `{"error":"unauthorized"}`.
10. Keys belong to the signed-in user. The secret is at least 32 random bytes before encoding. Store a hash of the secret, not the plaintext. Store timestamps in UTC.

## Non-Functional Requirements

- Do not replace or rewrite `src/legacy/session.cjs` or `src/legacy/query.cjs`.
- No new runtime dependency.
- Existing smoke (sign-in, add item, tag filter, `/api/items` with cookie) must stay green.
- Do not change the `playwright` Compose service, Playwright version, or `test/smoke/`.
- Extend Settings and `requireApiUser` / `loadUser`; do not add a parallel auth stack.
- Tests run in Docker (`make test-docker`, `make smoke`).

## Acceptance Criteria

1. From Settings, the user can create a named API key. After create, the plaintext shown once is a non-empty secret. Reloading Settings hides that plaintext.
2. An `api-key-row` lists the name and a created timestamp.
3. `GET /api/items` with `Authorization: Bearer` and the secret returns 200 with `items` and `count`, and includes an item the user created in the UI. No cookie is required.
4. Missing header, or `Authorization: Bearer not-a-key`, returns 401 with the exact body `{"error":"unauthorized"}`.
5. Cookie sessions still work: the signed-in browser can `GET /api/items` and `/items` still renders item rows.
6. After the key is used, last used is shown. Revoke is immediate: the same secret then returns 401 with the exact body.

## Interface Contract

| Control | `data-testid` |
|---|---|
| Settings keys section | `api-keys-section` |
| Name field | `api-key-name` |
| Create key button | `api-key-create` |
| One-time plaintext | `api-key-plaintext` |
| A listed key row | `api-key-row` |
| Created timestamp | `api-key-created` |
| Last used timestamp | `api-key-last-used` |
| Revoke control | `api-key-revoke` |

HTTP:

- Header: `Authorization: Bearer <key>` (identifier `header:authorization-bearer`).
- 401 body exactly `{"error":"unauthorized"}`.

Settings copy: section labeled **API keys**; explain that the secret is shown once and that revoke is immediate.

## Out of Scope

- OAuth, cookies-as-keys, per-key scopes, rate limits
- Admin UI for other users' keys
- Rotating a key (follow-up track)
- Rewriting the legacy session module
