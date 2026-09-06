# Contracts: API keys

## HTTP — JSON API (`/api/*`)

- **Header**: `Authorization: Bearer <plaintext>` (identifier `header:authorization-bearer`).
- **Valid secret, no cookie**: request authenticates as the owning user.
- **Missing header and no cookie**: `401` body exactly `{"error":"unauthorized"}`.
- **Invalid/revoked secret**: same `401` body, even if a valid session cookie is also sent.
- Cookie-only `GET /api/items` remains `200` as today.

## HTTP — Settings (cookie + CSRF)

- `POST /settings/api-keys` body: `_csrf`, `name`. Success: 200 HTML with `data-testid="api-key-plaintext"`. Empty name: 400 re-render with error.
- `POST /settings/api-keys/:id/revoke` body: `_csrf`. Success: 302 `/settings`. Unknown/other-user id: 404.

## UI locators

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
