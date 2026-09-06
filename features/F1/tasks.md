# Tasks — F1

Status markup: `- [ ]` open · `- [x]` done. A done task ends with `Evidence: <path or command>`.
`gatekit tasks --feature F1` exits 2 while any task is open or any done task lacks evidence;
the default contract runs it as the `tasks-complete` check.

- [x] T1 — Add `0004_api_keys.sql` and `src/api-keys/repo.ts` (create named key, list newest first, hash lookup, last used, revoke) Evidence: src/db/migrations/0004_api_keys.sql src/api-keys/repo.ts
- [x] T2 — Settings UI: `api-keys-section`, create (`api-key-name`, `api-key-create`), one-time `api-key-plaintext`, rows (`api-key-row`, `api-key-created`, `api-key-last-used`, `api-key-revoke`); `POST /api-keys` and `POST /api-keys/:id/revoke` Evidence: src/http/routes/settings.ts src/views/settings.ejs
- [x] T3 — Bearer auth on `/api/*` without cookie; missing/invalid header → 401 `{"error":"unauthorized"}`; cookie sessions unchanged Evidence: src/http/middleware/authenticate.ts test/unit/api-keys.test.ts
- [x] T4 — Unit tests via `make test-docker` and existing `make smoke` stay green Evidence: make test-docker
