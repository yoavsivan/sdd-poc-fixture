# F1 — plan

## Approach

Meet the brief in the existing Express + SQLite app without touching `src/legacy/session.cjs` or
`src/legacy/query.cjs`. Add a `api_keys` table (migration `0004`), a small repo that hashes the
Bearer secret with Node `crypto` (SHA-256; 32 random bytes, prefix plus secret), and teach
`requireApiUser`'s neighbour `loadUser` in `src/http/middleware/authenticate.ts` to accept
`Authorization: Bearer` on `/api/*` while leaving cookie sessions unchanged for the UI.

Settings already has a seam: `src/http/routes/settings.ts` and `src/views/settings.ejs`. Create
and revoke are HTML form posts (CSRF as today) at `POST /api-keys` and `POST /api-keys/:id/revoke`.
Show plaintext once from session flash (`api-key-plaintext`); list rows with `api-key-row`,
created/last-used as `YYYY-MM-DD`. Files that change: migration, `src/api-keys/`, authenticate
middleware, settings route and view, session data types, unit tests, a little CSS.

## Steps

1. Add `src/db/migrations/0004_api_keys.sql` and a TypeScript repo that creates, lists (newest
   first), looks up by secret hash, records last used, and revokes.
2. Extend `loadUser` so a Bearer secret on `/api/*` authenticates as the owning user; invalid or
   missing Bearer on the API still yields 401 `{"error":"unauthorized"}`; cookies still work
   when no Bearer header is sent.
3. Settings UI: `api-keys-section` with name field, create, one-time plaintext, rows, created,
   last-used, revoke. Copy labels the section “API keys”.
4. Unit tests in Vitest (run via `make test-docker`) covering create-once plaintext, Bearer
   `GET /api/items`, 401 body, last-used, immediate revoke, and cookie sessions. Existing smoke
   stays green via `make smoke`.

## Risks and decisions

- Do not rewrite legacy session; store the one-time plaintext in `session.data` only.
- No new runtime dependency: hash with `crypto.createHash("sha256")`.
- Bearer, when present, is the only API credential for that request (a bogus Bearer does not
  fall back to a valid cookie).
- Rotation is out of scope (F1').

## Hand-off

The session that planned is not the session that executes. Fill every row.

| Field | Value |
|---|---|
| **Planner** | trial seat (gatekit planner role) — wrote brief.md, contract.yaml and this plan, then stops |
| **Executor** | trial seat (gatekit executor role) — implements against brief.md, this file and contract.yaml |
| **Reviewer** | trial seat (gatekit reviewer role) — writes `.gatekit/verdicts/F1/<unit>.<kind>.c<n>.json`; not the executor |
| **Budget** | remaining wall time of the 60-minute seat; stop if a check cannot be met without changing brief.md |
| **Stop condition** | `gatekit done --feature F1` exits 0; or the budget is spent; or a check cannot be met without changing brief.md — then stop and report, do not edit the contract |
| **Inputs** | features/F1/brief.md, features/F1/plan.md, features/F1/contract.yaml, features/F1/tasks.md, src/http/middleware/authenticate.ts, src/http/routes/settings.ts, src/views/settings.ejs |
| **Outputs** | the diff, tasks.md with evidence, DONE.json |
