# UI/HTTP contract: Rotate

| Control | `data-testid` |
|---|---|
| Rotate | `api-key-rotate` |
| last rotated | `api-key-last-rotated` |

POST `/settings/api-keys/:id/rotate` (CSRF, signed-in owner). Redirect `/settings`. New plaintext once on `api-key-plaintext`.

Old Bearer → 401 `{"error":"unauthorized"}`. New Bearer → 200 on `/api/items`.
