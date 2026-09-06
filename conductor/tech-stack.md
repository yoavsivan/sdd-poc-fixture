# Tech stack

TypeScript strict, Express 4, EJS views, SQLite via `better-sqlite3`. Unit tests in Vitest. Browser tests in Playwright inside Docker (`make smoke`, `make test-docker`).

## Runtime

- Node.js >= 22
- Express, EJS, better-sqlite3
- Legacy CommonJS modules `src/legacy/session.cjs` and `src/legacy/query.cjs`, reached only through TypeScript wrappers (`src/http/middleware/session.ts`, `src/db/exec.ts`)

## Database

SQLite. Migrations are lexicographic `*.sql` files under `src/db/migrations/` applied by `src/db/migrate.ts`. Next free slot is `0004_…`. Follow existing `query.cjs` compile/insert/update patterns.

## Auth (as of setup)

Cookie sessions (`shelfmark.sid`) for the UI. Named API keys (SHA-256 of the plaintext, SQLite `api_keys`) authenticate `/api/*` via `Authorization: Bearer`. JSON API returns exactly `{"error":"unauthorized"}` when unsigned or when the Bearer secret is unknown. CSRF on HTML form posts; `/api/*` skips CSRF and requires `Content-Type: application/json` on writes.

## Tooling

- `make smoke` — Compose app + Playwright (`4 passed`)
- `make test-docker` — Vitest inside the app image
- Do not run the app or tests with the host Node toolchain
- No CI. No new runtime dependency unless a brief cannot be met without it.
- Do not change the `playwright` Compose service, Playwright version, or `test/smoke/`
