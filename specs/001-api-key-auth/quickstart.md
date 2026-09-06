# Quickstart: API-key authentication

Validate inside Docker. Do not use the host Node toolchain for the app or tests.

## Prerequisites

- `make smoke` already reports `4 passed` on this tree.
- Sign-in: `demo` / `demo-pass-1234`.

## Automated

```bash
make test-docker
make smoke
```

Expect Vitest green and smoke still `4 passed`.

## Manual (Compose app)

1. Sign in, add an item on `/items`.
2. Open Settings. Section `api-keys-section` labeled “API keys”.
3. Name a key, click create. Copy `api-key-plaintext` (non-empty).
4. Reload Settings: plaintext gone; `api-key-row` shows name and created date.
5. Call without cookie:

```bash
curl -s -H "Authorization: Bearer <plaintext>" http://localhost:3000/api/items
```

Expect 200 with `items` and `count` including the UI item.

6. `curl -s http://localhost:3000/api/items` and `Authorization: Bearer not-a-key` both 401 `{"error":"unauthorized"}`.
7. Reload Settings: last used shown. Revoke. Repeat step 5 → 401 exact body.
8. Browser `/items` still lists rows; cookie `GET /api/items` still 200.
