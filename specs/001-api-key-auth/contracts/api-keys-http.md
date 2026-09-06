# HTTP contract: Bearer on `/api/*`

## Header

`Authorization: Bearer <plaintext-secret>`  
Identifier: `header:authorization-bearer`

## Success

`GET /api/items` with a valid unrevoked secret and no cookie:

- Status: 200
- Body: `{ "items": [...], "count": <number> }`
- Includes items the owning user created in the UI
- Authenticates as that user for all `/api/*` routes that already use `requireApiUser`

## Failure (exact)

Status 401. Body bytes/JSON exactly:

```json
{"error":"unauthorized"}
```

Applies when:

- No cookie and no Authorization header
- `Authorization: Bearer not-a-key`
- Revoked secret
- Bearer present on `/api/*` but secret does not match an active key (cookie ignored)

Cookie-only requests behave as today: valid session → 200; none/tampered → 401 same body.
