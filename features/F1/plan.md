# F1 — plan

## Approach

Keep the legacy session module and cookie UI sign-in unchanged. Add a SQLite
`api_keys` table (new migration `src/db/migrations/0004_api_keys.sql`) and a
small repo at `src/api-keys/repo.ts`. Settings (`src/http/routes/settings.ts`,
`src/views/settings.ejs`) grows an “API keys” section with the contracted
`data-testid`s. `src/http/middleware/authenticate.ts` accepts
`Authorization: Bearer` on `/api/*` when no session user is present, looking up
the SHA-256 of the presented secret. Revoke sets `revoked_at` so the same secret
fails immediately. No new runtime dependency: Node `crypto` only.

## Steps

1. Add migration `0004_api_keys.sql` and `src/api-keys/repo.ts` (create, list
   newest first, lookup by hash, touch last used, revoke).
2. Extend Settings: `POST /api-keys` and `POST /api-keys/:id/revoke`, section
   `api-keys-section`, one-time plaintext via session flash.
3. Load Bearer keys in authenticate for `/api/*`; keep `requireApiUser` 401 body
   `{"error":"unauthorized"}`.
4. Unit tests in Docker (`make test-docker`) covering create, bearer GET
   `/api/items`, invalid/missing header, revoke, last used, cookie still works.
5. Confirm existing smoke (`make smoke`) stays green.

## Risks and decisions

- Hash the full plaintext with SHA-256 for O(1) lookup; do not scan with scrypt.
- Show prefix plus masked tail in the list; store prefix and last-four, never
  the secret after create.
- Timestamps stored as UTC ISO-8601; UI shows `YYYY-MM-DD`.
- Rotation is out of scope (F1').
- Legacy `src/legacy/session.cjs` is not rewritten; optional `apiKeyPlaintext`
  lives only on `SessionData` types.

## Hand-off

The session that planned is not the session that executes. Fill every row.

| Field | Value |
|---|---|
| **Planner** | grok-4.6:high trial seat — wrote brief.md, contract.yaml and this plan, then stops |
| **Executor** | grok-4.6:high trial seat after plan approval; starts by reading brief.md, this file and contract.yaml |
| **Reviewer** | required_gates empty for this single-session trial; no executor-written verdict required |
| **Budget** | remaining wall time of the 60-minute seat |
| **Stop condition** | `gatekit done --feature F1` exits 0; or the budget is spent; or a check cannot be met without changing brief.md — then stop and report, do not edit the contract |
| **Inputs** | features/F1/brief.md, features/F1/plan.md, features/F1/contract.yaml, src/http/middleware/authenticate.ts, src/http/routes/settings.ts, src/views/settings.ejs |
| **Outputs** | the diff, tasks.md with evidence, features/F1/DONE.json |
