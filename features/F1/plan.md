# F1 — plan

## Approach

Keep the legacy session module and cookie sign-in. Add an `api_keys` SQLite table, hash stored
secrets with SHA-256, and accept `Authorization: Bearer` on `/api/*` in authenticate middleware so
`requireApiUser` still returns `{"error":"unauthorized"}`. Settings gains an API keys panel with the
brief's `data-testid`s; create and revoke are form POSTs with existing CSRF.

Files: `src/db/migrations/0004_api_keys.sql`, `src/apikeys/repo.ts`, `src/http/middleware/authenticate.ts`,
`src/http/routes/settings.ts`, `src/views/settings.ejs`, `src/legacy/session.d.cts` (types only),
`src/public/styles.css`, `test/unit/api-keys.test.ts`, `test/unit/migrations.test.ts`.

## Steps

1. Migration `0004_api_keys.sql`: id, user_id, name, prefix, secret_hash, created_at, last_used_at.
2. `src/apikeys/repo.ts`: mint ≥32 random bytes, hash, list newest first, revoke, touch last used.
3. Bearer load in authenticate: valid secret sets `res.locals.user`; invalid Bearer on `/api/*` yields 401; cookies unchanged when the header is absent.
4. Settings GET lists keys; `POST /api-keys` creates and shows plaintext once via session; `POST /api-keys/:id/revoke` deletes immediately.
5. Unit tests in Docker for create/list/bearer/401/revoke/last-used; `make smoke` stays green.

## Risks and decisions

- Hash the full plaintext; never store it. Prefix plus masked tail only in the list.
- Invalid Bearer on `/api/*` does not fall back to the cookie (matches AC 4).
- One-time plaintext lives in session data for a single GET after create, then is cleared.
- `last_rotated_at` is omitted until F1'.

## Hand-off

The session that planned is not the session that executes. Fill every row.

| Field | Value |
|---|---|
| **Planner** | grok-4.6 seat — wrote brief.md, contract.yaml and this plan |
| **Executor** | grok-4.6 seat — implements from brief.md, this file and contract.yaml |
| **Reviewer** | grok-4.6 seat — writes `.gatekit/verdicts/F1/<unit>.<kind>.c<n>.json`; not as code author of the verdict target |
| **Budget** | remaining wall time of the 60-minute seat |
| **Stop condition** | `gatekit done --feature F1` exits 0; or the budget is spent; or a check cannot be met without changing brief.md — then stop and report, do not edit the contract |
| **Inputs** | features/F1/brief.md, plan.md, contract.yaml, HUMAN.md project-context |
| **Outputs** | the diff, tasks.md with evidence, DONE.json |
