# Contracts: rotate

- `POST /settings/api-keys/:id/rotate` with `_csrf`. Success: 200 HTML with `api-key-plaintext` for the new secret. Same row id and name. `api-key-last-rotated` after reload.
- Old Bearer secret: `401 {"error":"unauthorized"}`. New secret: 200 on `GET /api/items`.

| Control | `data-testid` |
|---|---|
| Rotate | `api-key-rotate` |
| last rotated | `api-key-last-rotated` |
