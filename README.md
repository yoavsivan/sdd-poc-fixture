# Shelfmark

Shelfmark is a small web app for saving links with notes and tags — you paste a URL, add a note and a few tags, and find the link later by tag or by a word in the title. I built it to be the *fixture* for a three-way look at *spec-driven development*: the single existing codebase all three attempts start from. The idea being tested is to write down what software should do before an AI agent writes the code, then keep that document as the standard the finished code is checked against. The app is deliberately imperfect, with enough real code to carry the habits of a project with a history and few enough files to read in one sitting. It ships without API key authentication, because adding that is the feature under test.

## What "brownfield" and "legacy module" mean here

*Brownfield* means work on software that already exists: it has history, conventions, and a corner or two nobody wants to touch, unlike a blank project. Shelfmark is that existing software. Every request passes through a *legacy module* — a file in the project's older style, callback-based JavaScript with no type checking, that newer code has to work with rather than replace. Most codebases with a few years on them have a corner like this, and this comparison needs one.

There are two such files. `src/legacy/session.cjs` handles sign-in state: it mints a signed cookie called `shelfmark.sid`, keeps the live sessions in memory, and attaches `req.session` to every request. `src/legacy/query.cjs` is a small SQL builder, where `:name` becomes a bound parameter and `{{ident}}` splices in a column or table name after a whitelist check. Values never reach the SQL text by string concatenation. The current TypeScript reaches both files through thin wrappers, `src/http/middleware/session.ts` and `src/db/exec.ts`, and the rule here is to wrap them, never rewrite them.

## Run it

You need Docker and Docker Compose. To run pieces directly on your machine instead, you also want Node 22, bash, curl, and cloc.

Start with the *smoke test* — a short automated run that drives the app through its main paths in a real browser and fails if any of them break:

```bash
make smoke
```

That target builds the image, starts the app, waits until `GET /healthz` reports healthy, and runs four browser tests in a container. A good run ends with `4 passed`.

To click around yourself:

```bash
make dev
```

Open `http://localhost:3000` and sign in as `demo` with the password `demo-pass-1234`. Two other targets matter early: `make test` runs the unit suite, and `make loc` counts the tree against a fixed size budget.

## What is in the box

- Sign-in with one seeded user. There is no registration form.
- A server-rendered item list at `/items`, narrowed by `?tag=` (one exact tag) or `?q=` (a substring of the title, URL, or note).
- Create, edit, and delete items. An item is a URL, a title, an optional note, and up to ten tags.
- A settings page at `/settings` for the account, a password change, and a short note about calling the API.
- A JSON API: `/api/items` lists and creates, `/api/items/:id` fetches and deletes. It accepts the browser's session cookie and nothing else, and a request without a valid session gets exactly `{"error":"unauthorized"}`. A write without `Content-Type: application/json` is refused with `415`.
- `GET /healthz`, which answers `{"ok":true}` and is what the Compose healthcheck waits on.

Visiting the UI without a session redirects you to `/signin?next=`, and an HTML form post without its hidden `_csrf` field renders a 403 page.

## Using the API from a script

The API's first consumer is a pair of shell scripts in the repository, and they show how a machine talks to Shelfmark today. From a clean tree, this sequence signs in, imports three sample links, reads them back by tag, then walks into the two ways the import can fail:

```bash
make clean
make dev &
until curl -sf http://localhost:3000/healthz >/dev/null; do sleep 1; done
C=$(scripts/login.sh demo demo-pass-1234)
SHELFMARK_COOKIE="$C" scripts/import.sh scripts/sample-import.jsonl
curl -s -b "$C" 'http://localhost:3000/api/items?tag=reading'
scripts/import.sh scripts/sample-import.jsonl
SHELFMARK_COOKIE='shelfmark.sid=bogus' scripts/import.sh scripts/sample-import.jsonl
```

`login.sh` fetches `/signin`, posts the form with its CSRF token, and prints a `shelfmark.sid=` cookie. `import.sh` posts one JSONL line at a time to `/api/items`. The sample file holds three rows, all tagged `reading`, so the good path ends with `imported 3 items (0 failed)` and the read-back reports `"count":3`.

The last two commands are the failure paths. With no cookie in the environment, `import.sh` prints usage naming `SHELFMARK_COOKIE` and exits 2. With a bogus cookie it gets `fail  401` on every line, finishes with `imported 0 items (3 failed)`, and exits 1.

That is the part of the design I would not defend: today a script has to fish a browser-style cookie out of a login form before it can call anything.

## Where a new feature would go

If you add something that has to stand next to cookie sessions, the seams already exist:

- `requireApiUser` in `src/http/middleware/authenticate.ts` — the one check the JSON API runs before serving a request.
- `src/http/routes/api.ts` — the `router.use` at the top, so a new `/api/*` route inherits the same guard.
- `src/http/routes/settings.ts` and the matching block in `src/views/settings.ejs` — where a new settings section and its routes belong.
- `src/db/migrations/` — the next free slot is `0004_…`, and the runner picks up any `*.sql` file it finds.
- `src/legacy/session.cjs` — which you may or may not decide to touch, since everything else reaches it through the TypeScript wrapper.

## Known rough edges (kept on purpose)

- Sessions live in memory. Restart the process and everyone is signed out.
- One seeded user, no sign-up.
- The API accepts JSON only, and that content-type rule is its whole defence against cross-site form posts.
- Scripts get a session cookie through `login.sh` rather than a credential of their own.
- `query.cjs` will splice an identifier that passes its whitelist. Values stay parameterized; identifiers do not.

None of these is a bug I forgot about. They are the texture of a small app in real use, and the comparison is more honest with them left in.

## Size

The tree is deliberately bounded, so a reader — or an agent — can hold all of it at once:

```bash
make loc
```

On this tag the `SUM` code line is **4125**, inside the 3,500–4,500 window the script enforces before exiting 0. The count runs `cloc` over the git-tracked files and excludes `harness/`, `package-lock.json`, `.gitignore`, `.dockerignore`, and `.env.example`.

## Tests

`make test` runs the unit suite with Vitest. The design set a floor of twenty cases; this tree ships **forty-five**. They cover cookie signing, tampering, and expiry in the legacy session layer, and hostile strings staying inside the parameter list in the query builder. The rest reach migrations, item and tag rules, and the HTTP boundary: the session check, CSRF, all four API calls, the password change, and a failed sign-in.

The four browser tests, by name, are `sign-in`, `add item`, `tag filter`, and `/api/items with cookie`. Run them with `make smoke`, which drives the Compose app in containers, or `make smoke-local`, which runs Playwright on your machine against a server you already started.

## `harness/`

The experiment itself will live in a `harness/` directory added in a later commit, so you will not find it here. The app is frozen at tag `fixture-v1` before any trial begins. The ignore rules already exclude that directory, so its arrival cannot change the app image or the line count above.

## License

MIT. Copyright (c) 2026 Apricode. Built and maintained by Apricode / `yoavsivan`.
