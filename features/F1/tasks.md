# Tasks — F1

Status markup: `- [ ]` open · `- [x]` done. A done task ends with `Evidence: <path or command>`.
`gatekit tasks --feature F1` exits 2 while any task is open or any done task lacks evidence;
the default contract runs it as the `tasks-complete` check.

- [x] T1 — Add api_keys migration 0004 and repo (create, list newest first, lookup by hash, last used, revoke) Evidence: src/db/migrations/0004_api_keys.sql src/api-keys/repo.ts
- [x] T2 — Authenticate GET /api/items and /api/* with Authorization Bearer; keep cookie sessions; 401 {"error":"unauthorized"} Evidence: src/http/middleware/authenticate.ts test/unit/api-keys.test.ts
- [x] T3 — Settings UI: api-keys-section, api-key-name, api-key-create, api-key-plaintext (once), api-key-row, api-key-created, api-key-last-used, api-key-revoke; POST /api-keys and POST /api-keys/:id/revoke Evidence: src/http/routes/settings.ts src/views/settings.ejs
- [x] T4 — Unit tests in Docker (make test-docker) and keep make smoke green Evidence: make test-docker (52 passed) make smoke (4 passed)
- [x] T5 — Rotate keeps id and name, shows new secret once (api-key-plaintext), retires old secret immediately Evidence: src/api-keys/repo.ts src/http/routes/settings.ts test/unit/api-keys.test.ts
- [x] T6 — Show api-key-last-rotated after rotation; POST /api-keys/:id/rotate; unit tests in Docker Evidence: src/views/settings.ejs src/db/migrations/0005_api_keys_last_rotated.sql make test-docker (53 passed)
