# Tasks — F1

Status markup: `- [ ]` open · `- [x]` done. A done task ends with `Evidence: <path or command>`.
`gatekit tasks --feature F1` exits 2 while any task is open or any done task lacks evidence;
the default contract runs it as the `tasks-complete` check.

- [x] T1 — Add SQLite migration 0004_api_keys.sql (id, user_id, name, prefix, secret_hash, created_at, last_used_at) Evidence: src/db/migrations/0004_api_keys.sql
- [x] T2 — Implement api key repo: mint ≥32 random bytes, SHA-256 hash, list newest first, revoke, touch last used Evidence: src/apikeys/repo.ts
- [x] T3 — Accept Authorization Bearer on /api/*; invalid or missing key → 401 {"error":"unauthorized"}; cookie sessions unchanged without the header Evidence: src/http/middleware/authenticate.ts
- [x] T4 — Settings API keys section: create named key, one-time plaintext, row timestamps, revoke POST /api-keys/:id/revoke Evidence: src/http/routes/settings.ts src/views/settings.ejs
- [x] T5 — Docker unit tests for create, plaintext-once, bearer GET /api/items, 401 body, last-used, revoke Evidence: test/unit/api-keys.test.ts make test-docker
- [x] T6 — make smoke stays 4 passed (sign-in, add item, tag filter, /api/items with cookie) Evidence: make smoke
- [x] T7 — Add last_rotated_at and rotate that keeps id and name, shows new plaintext once, retires the old secret Evidence: src/apikeys/repo.ts src/db/migrations/0005_api_keys_rotate.sql
- [x] T8 — Settings rotate control api-key-rotate and last rotated api-key-last-rotated (ISO-8601 date) Evidence: src/views/settings.ejs src/http/routes/settings.ts
- [x] T9 — Docker tests: rotate keeps id/name, old Bearer 401, new Bearer 200, last rotated shown Evidence: test/unit/api-keys.test.ts make test-docker
