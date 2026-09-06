# Quickstart: API-key authentication

1. Sign in as `demo` / `demo-pass-1234`.
2. Open Settings. The “API keys” section is present.
3. Enter a name, create a key, copy the one-time plaintext.
4. Reload Settings: plaintext is gone; a row shows name and created date (`YYYY-MM-DD`).
5. Create an item in the UI.
6. `curl -H "Authorization: Bearer <secret>" http://localhost:3000/api/items` — 200 with that item; no cookie.
7. `curl http://localhost:3000/api/items` and `curl -H "Authorization: Bearer not-a-key" …` — 401 `{"error":"unauthorized"}`.
8. Use the key, reload Settings, see last used. Revoke. Repeat step 6 — 401.

Gates: `make test-docker`, `make smoke` (`4 passed`).
