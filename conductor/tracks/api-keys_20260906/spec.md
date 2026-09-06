# Spec: Named API keys and Bearer auth

## Overview

A signed-in Shelfmark user can create a named API key in Settings and call the JSON API as that user with `Authorization: Bearer <secret>` and no cookie. Cookie sessions stay how the UI signs in. The legacy session module is not rewritten.

## Functional requirements

1. Settings exposes an “API keys” section (`data-testid="api-keys-section"`). Copy explains that the secret is shown once and that revoke is immediate.
2. The user submits a name (`api-key-name`) and Create (`api-key-create`). After create, a non-empty plaintext secret is shown once (`api-key-plaintext`). Reloading Settings hides that plaintext.
3. The plaintext is a short prefix plus a random secret with at least 32 random bytes before encoding.
4. Each listed key is an `api-key-row` showing the name, created date (`api-key-created`), optional last used (`api-key-last-used`), prefix plus masked tail, and Revoke (`api-key-revoke`). Rows are newest first.
5. Created and last-used timestamps in the UI are ISO-8601 dates `YYYY-MM-DD`. Values are stored as UTC internally.
6. `GET /api/items` with `Authorization: Bearer <plaintext>` and no cookie returns 200 `{ items, count }` as the owning user, including items created in the UI.
7. Missing `Authorization`, or `Authorization: Bearer not-a-key`, returns 401 with body exactly `{"error":"unauthorized"}`.
8. Cookie sessions still work: a signed-in browser can `GET /api/items` and `/items` still renders item rows.
9. After the key is used, last used is shown. Revoke is immediate: the same secret then returns 401 with that exact body.
10. Bearer authenticates all `/api/*` routes as the owning user.

## Non-functional requirements

- Wrap, do not rewrite, `src/legacy/session.cjs` and `src/legacy/query.cjs`.
- No new runtime dependency.
- Existing smoke must stay green. Do not change the Playwright Compose service, Playwright version, or `test/smoke/`.
- Hash stored secrets; never persist plaintext after the create response.

## Acceptance criteria

1. From Settings, create a named API key; plaintext shown once is non-empty; reload hides it.
2. An `api-key-row` lists the name and a created timestamp.
3. `GET /api/items` with Bearer secret returns 200 with `items` and `count`, including a UI-created item; no cookie required.
4. Missing header or `Bearer not-a-key` returns 401 `{"error":"unauthorized"}`.
5. Cookie sessions still work for `GET /api/items` and `/items` rows.
6. After use, last used is shown. Revoke is immediate; the old secret then 401s with the exact body.

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

HTTP: `Authorization: Bearer <key>` (`header:authorization-bearer`). 401 body exactly `{"error":"unauthorized"}`.

## Out of scope

OAuth, cookies-as-keys, per-key scopes, rate limits, admin UI for other users' keys, rotating a key.
