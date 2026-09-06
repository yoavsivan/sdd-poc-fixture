# Technology Stack

## Language and runtime

- TypeScript, strict (`tsconfig.json`), compiled with TypeScript 5.7.
- Node.js 22+.
- ES modules (`"type": "module"`).

## Application

- Express 4 for HTTP.
- EJS server-rendered views under `src/views/`.
- Static assets in `src/public/`.
- `better-sqlite3` for persistence. Migrations are lexicographic `*.sql` files under `src/db/migrations/` (next slot: `0004_…`).
- Sessions: wrap `src/legacy/session.cjs` through `src/http/middleware/session.ts`. Do not rewrite the legacy module.
- SQL: wrap `src/legacy/query.cjs` through `src/db/exec.ts`. Do not rewrite the legacy module.
- Passwords: Node `crypto.scrypt` via `src/users/password.ts`.
- No new runtime dependency unless a feature brief cannot be met without it.

## Auth seams (brownfield)

- UI guard: `requireUser` in `src/http/middleware/authenticate.ts`.
- API guard: `requireApiUser` in the same file; applied to every `/api/*` route via `src/http/routes/api.ts`.
- Settings UI/routes: `src/http/routes/settings.ts` and `src/views/settings.ejs`.
- Cookie sessions remain how the UI signs in.

## Tests and tooling

- Unit tests: Vitest, run **inside Docker** with `make test-docker`.
- Browser smoke: Playwright 1.52.0 **inside Docker** with `make smoke`. Do not change the `playwright` Compose service, Playwright version, or `test/smoke/`.
- Make targets only; no CI.
- Team size: 1.

## Constraints

- Do not run the app or tests with the host Node toolchain.
- Do not replace legacy session or query modules.
- SQLite patterns already used in the fixture (TEXT ISO timestamps, integer PKs, foreign keys ON).
