# Specification: Named API keys (F1)

## Overview

A signed-in Shelfmark user can create a named API key in Settings and use the
secret as `Authorization: Bearer` so the JSON API authenticates without a
cookie. Cookie sessions stay the UI sign-in path. The legacy session module is
not rewritten.

This track is the F1 feature brief for API-key authentication.

## Functional Requirements

1. **Create.** From Settings, the user can create a named API key. After create,
   the UI shows a non-empty plaintext secret once (`data-testid="api-key-plaintext"`).
   Reloading Settings must not show that plaintext again.
2. **List.** Each key appears as `data-testid="api-key-row"` with the name and a
   created timestamp (`data-testid="api-key-created"`) as an ISO-8601 date
   `YYYY-MM-DD`. Rows are newest first. The list shows a short prefix and a
   masked tail, never the full secret.
3. **Bearer auth.** `GET /api/items` with `Authorization: Bearer <secret>` and
   no cookie returns 200 with `items` and `count`, including items the user
   created in the UI. The key authenticates `/api/*` as the owning user.
4. **Unauthorized.** Missing `Authorization` header, or
   `Authorization: Bearer not-a-key`, returns 401 with the exact body
   `{"error":"unauthorized"}`.
5. **Cookies unchanged.** A signed-in browser can still `GET /api/items` with
   the session cookie, and `/items` still renders item rows.
6. **Last used and revoke.** After the key is used, last used is shown
   (`data-testid="api-key-last-used"`, `YYYY-MM-DD`). Revoke
   (`data-testid="api-key-revoke"`) is immediate: the same secret then returns
   401 with the exact body.

## Interface contract

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

## Non-Functional Requirements

- Secret entropy: at least 32 random bytes before encoding.
- Store UTC timestamps internally; render dates as `YYYY-MM-DD`.
- Hash stored secrets; do not persist plaintext after the create response.
- No new runtime dependency.
- Do not replace `src/legacy/session.cjs` or `src/legacy/query.cjs`.
- Do not change the Playwright Compose service, Playwright version, or `test/smoke/`.
- Existing smoke (sign-in, add item, tag filter, `/api/items` with cookie) stays green.
- Tests run in containers: `make test-docker`, `make smoke`.

## Settings copy

Section labelled **API keys**. Explain that the secret is shown once and that
revoke is immediate.

## Acceptance Criteria

1. Creating a named key from Settings shows a non-empty plaintext once; reload hides it.
2. An `api-key-row` lists the name and a created timestamp.
3. `GET /api/items` with Bearer secret returns 200 `{ items, count }` including a UI-created item; no cookie required.
4. Missing header or `Authorization: Bearer not-a-key` returns 401 `{"error":"unauthorized"}`.
5. Cookie sessions still work for `GET /api/items` and `/items` still renders rows.
6. After use, last used is shown. After revoke, the same secret returns 401 `{"error":"unauthorized"}`.

## Out of Scope

- OAuth, cookies-as-keys, per-key scopes, rate limits.
- Admin UI for other users' keys.
- Rotating a key (follow-up track).
