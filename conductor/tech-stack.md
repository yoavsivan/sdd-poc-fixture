# Technology Stack

## Language and runtime

- TypeScript, `strict` (`tsconfig.json`), compiled with `tsc`.
- Node.js >= 22. ESM (`"type": "module"`).
- Two legacy CommonJS modules remain: `src/legacy/session.cjs` and `src/legacy/query.cjs`. Reach them only through their TypeScript wrappers (`src/http/middleware/session.ts`, `src/db/exec.ts`). Do not rewrite those legacy files.

## Web stack

- Express 4 for HTTP.
- EJS templates under `src/views/` with a shared layout.
- Static assets in `src/public/` (`app.js`, `styles.css`).
- better-sqlite3 for persistence. Migrations are numbered SQL files in `src/db/migrations/` (next free slot `0004_…`).

## Auth (as of fixture)

- Cookie sessions via the legacy session module: signed `shelfmark.sid`, in-memory store, CSRF on HTML forms.
- Named API keys stored in SQLite (`api_keys`). SHA-256 hash of the secret; plaintext shown once at create. `Authorization: Bearer` authenticates `/api/*` as the owning user (`loadApiKeyUser` + `requireApiUser`). Unauthenticated API responses are exactly `{"error":"unauthorized"}`.

## Testing

- Unit tests: Vitest + Supertest, run **inside the app container** (`make test-docker`). Do not use the host Node toolchain for app tests.
- Browser smoke: Playwright 1.52.0 inside Docker (`make smoke`). Do not change the `playwright` Compose service, Playwright version, or `test/smoke/`.
- Seeded credentials for tests and manual use: `demo` / `demo-pass-1234`.

## Tooling and workflow

- Docker Compose for app + Playwright.
- Make targets: `install`, `dev`, `build`, `test`, `test-docker`, `smoke`, `smoke-local`, `loc`, `clean`.
- No CI. No new runtime dependency unless a brief cannot be met without it.

## Deliberate non-goals in the stack

- OAuth providers, Redis, ORMs, extra auth libraries.
