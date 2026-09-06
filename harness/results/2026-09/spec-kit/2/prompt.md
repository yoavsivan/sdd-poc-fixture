# Uniform seat protocol

You are implementing one feature and one follow-up in an existing app you have never seen. Work only inside this repository and the arm's own clone under `/tmp/`. Do not fetch other branches, do not read `main`, do not look for tests that are not in this tree. Acceptance tests exist for this feature; they are not available to you and will be run later against the commits you tag. The feature brief below states what they check.

Your model is grok-4.6:high. Your wall budget is 60 minutes. Your deliverable branch is trial/spec-kit/2.

## Before anything else (logged)

`mkdir -p .trial` · `docker compose version > .trial/env.txt` · `make smoke 2>&1 | tee .trial/smoke-before.txt`. If Docker is unavailable or the smoke is not `4 passed`, write `.trial/ABORT.md` with the exact error, commit, push, and end. Do not run the app or any test with the host Node toolchain; the app and every test run in the fixture's containers (`make smoke`, `make test-docker`).

## Install your arm

# Spec Kit (GitHub github/spec-kit)

Lifecycle: template-first.

## Install

Pinned commit `4a7341a93d944d6efe153b71da4a1adb9c2b578c` from `https://github.com/github/spec-kit`.

```
uv tool run --from git+https://github.com/github/spec-kit.git@4a7341a93d944d6efe153b71da4a1adb9c2b578c specify init --here --integration cursor-agent || pipx run --spec git+https://github.com/github/spec-kit.git@4a7341a93d944d6efe153b71da4a1adb9c2b578c specify init --here --integration cursor-agent
```

Commit the generated `.specify/` and `.cursor/skills/` (or `.cursor/commands/` if that is what init wrote) as part of your first commit.

Protocol files (read and follow, in order):

- .cursor/skills/speckit-constitution/SKILL.md
- .cursor/skills/speckit-specify/SKILL.md
- .cursor/skills/speckit-clarify/SKILL.md
- .cursor/skills/speckit-plan/SKILL.md
- .cursor/skills/speckit-tasks/SKILL.md
- .cursor/skills/speckit-analyze/SKILL.md
- .cursor/skills/speckit-implement/SKILL.md
- https://github.com/github/spec-kit/blob/4a7341a93d944d6efe153b71da4a1adb9c2b578c/docs/guides/evolving-specs.md

## F1 sequence

Open and follow, in order: /speckit.constitution, /speckit.specify, /speckit.clarify, /speckit.plan, /speckit.tasks, /speckit.analyze, /speckit.implement — `/speckit.constitution` then `/speckit.specify` (with the F1 brief) then `/speckit.clarify` (answer from HUMAN.md) then `/speckit.plan` then `/speckit.tasks` then `/speckit.analyze` then `/speckit.implement`.

## F1' change flow

The upstream docs at this commit (docs/guides/evolving-specs.md, flow-forward spec) prescribe a new numbered feature via `/speckit.specify` for a substantial follow-up, then `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`. Record the choice in `.trial/f1p-flow.md`. Merge any feature branch Spec Kit created into the deliverable branch before tagging.

Stock sequence: /speckit.specify, /speckit.plan, /speckit.tasks, /speckit.implement

## Where your spec lives

specs/ (+ `.specify/`). Scored files: `specs/<NNN>-<name>/spec.md` and `tasks.md`.


Read the arm's protocol files listed there and follow them as your operating instructions. Run only the stock commands in the order listed. If a stock command is a slash-command file, open that file and follow it as the prompt. Do not edit the arm's templates or protocol files. Do not add commands the arm does not ship.

## Human-decision points

Whenever the arm's flow stops for a person — a question, a menu, an approval, a clarification — do not wait. Look up the answer in HUMAN.md (inlined below) by decision type and topic; if no entry applies, apply the defaults rule. Before continuing, append one line to `.trial/decisions.jsonl`:

`{"turn": <your best estimate of the current turn index or null>, "type": "clarify|choose-option|approve-plan|approve-completion|scope|product|other", "question": "<≤200 chars>", "source": "HUMAN.md#<anchor>|default", "answer": "<≤200 chars>"}`.

Then answer the flow as if the person had said that.

## F1

Implement the F1 brief (inlined below) through the arm's stock flow. When the arm's flow says the feature is complete, commit everything (including the arm's spec folder and `.trial/`), then run `git tag done-f1` and record `{"done-f1": "<sha of that commit>"}` in `.trial/tags.json`; commit that file as `trial: record done-f1`.

## F1'

Only now read the F1' brief (inlined below, after the separator). Run the arm's stock change flow as the arm block describes. Write one paragraph to `.trial/f1p-flow.md` naming which stock flow you used for the follow-up and why the arm's docs prescribe it. When complete: commit, `git tag done-f1p`, add `"done-f1p": "<sha>"` to `.trial/tags.json`, commit as `trial: record done-f1p`.

## Deliver

`git push -u origin trial/spec-kit/2`. Then, best effort: `git push origin done-f1:refs/tags/trial/spec-kit/2/done-f1 done-f1p:refs/tags/trial/spec-kit/2/done-f1p`. If tag push fails, say so in `.trial/notes.md` and continue — the harness reads `.trial/tags.json`. If the arm's flow created other branches, merge them into trial/spec-kit/2 before each tag and push only the deliverable branch.

## Stop conditions

When the harness sends "Time is up", finish the current commit, record whatever tags exist, push, end. Never delete `.trial/`. Never force-push. Never modify `docker-compose.yml`'s `playwright` service, `playwright.config.ts`, the Playwright version, or `test/smoke/` — the existing smoke must stay runnable as is.

## What is off limits

Reading or fetching anything from `main` or from `harness/` (it is not in your tree; do not go looking); any credential other than the one Git already has; any model or API other than the one you are running as; any other trial branch.

## HUMAN.md

# Human decisions

Pre-declared answers for every arm. When a flow stops for a person, look up the matching section below; record the source as `HUMAN.md#<anchor>` in `.trial/decisions.jsonl`.

## project-context

Shelfmark is a small web app for saving links with notes and tags — you paste a URL, add a note and a few tags, and find the link later by tag or by a word in the title. It is the brownfield fixture for this comparison: enough real code to carry project history, deliberately without API-key authentication until F1.

Tech stack as it stands: TypeScript strict, unit tests in Vitest, browser tests in Playwright inside Docker (`make smoke`, `make test-docker`). Wrap `src/legacy/session.cjs` and `src/legacy/query.cjs` through their TypeScript wrappers; do not rewrite those legacy modules. Sign-in for manual and scripted use: username `demo`, password `demo-pass-1234`. Team size 1. No CI — local Docker and Make targets only. No new runtime dependency unless the brief cannot be met without it.

## product

API keys: display format is a short prefix plus a random secret (show prefix and masked tail in the list; show full plaintext once at create). Key length: enough entropy for a bearer secret (at least 32 random bytes before encoding). Settings copy: label the section “API keys”, explain that the secret is shown once, and that revoke is immediate. Item list ordering: newest first (same as existing `/items`). Timestamps in the UI: ISO-8601 date (`YYYY-MM-DD`) for created and last-used; store UTC internally.

## scope

In scope: exactly what the F1 and F1' briefs state — named API keys, Bearer auth on `/api/*`, cookie sessions unchanged, interface contract `data-testid`s and 401 body. Out of scope: anything each brief lists as out of scope (OAuth, per-key scopes, rate limits, admin UI for other users' keys; rotation is F1' only). If unsure, take the smaller reading that still satisfies the brief's acceptance criteria.

## approvals

Plan approval (`approve-plan`): approve if every acceptance criterion in the active brief maps to at least one task or implementation step; otherwise ask the flow to revise once, then approve. Completion approval (`approve-completion`): approve only after the arm's own checks pass (e.g. gate check, smoke, or stock “done” command) and the feature matches the brief. Do not approve completion on partial work.

## clarify

When a menu or clarification offers multiple options, prefer the choice that keeps existing tests green and leaves the legacy session module unmodified unless the brief explicitly requires touching it. Prefer extending the JSON API and settings UI over new top-level apps or parallel auth stacks. Prefer SQLite patterns already used in the fixture.

## defaults

For anything not covered above: choose the option that satisfies the brief's criteria with the least new surface area; never skip a test; never ask the human again — decide, record `source: default` in `.trial/decisions.jsonl`, and continue.

## changelog

2026-09-05T00:00Z · project-context · initial answers · trials already spawned: none


## features/F1.md

# F1 — API-key authentication

A signed-in user of Shelfmark, the reading-list app under test, can create a named API key in Settings and use it as a Bearer token so that the JSON API authenticates without a cookie.

## Intent

Today `/api/items` only accepts the browser session cookie. F1 adds API keys so a script can call the JSON API as that user. The user creates a named API key, sees the plaintext shown once, and later authenticates with `Authorization: Bearer` holding that secret. The API key authenticates `/api/*` as the owning user.

## Acceptance criteria (prose)

1. From Settings, the user can create a named API key. After create, the plaintext shown once is a non-empty secret. Reloading Settings hides that plaintext.
2. An `api-key-row` lists the name and a created timestamp.
3. `GET /api/items` with `Authorization: Bearer` and the secret returns 200 with `items` and `count`, and includes an item the user created in the UI. No cookie is required.
4. Missing header, or `Authorization: Bearer not-a-key`, returns 401 with the exact body `{"error":"unauthorized"}`.
5. Cookie sessions still work: the signed-in browser can `GET /api/items` and `/items` still renders item rows.
6. After the key is used, last used is shown. Revoke is immediate: the same secret then returns 401 with the exact body.

## Interface contract

These `data-testid` values are the locators the acceptance tests will use. Arms choose routes, storage, and code structure.

| Control | `data-testid` |
|---|---|
| Settings keys section | `api-keys-section` |
| Name field | `api-key-name` |
| Create key button | `api-key-create` |
| One-time plaintext | `api-key-plaintext` |
| A listed key row | `api-key-row` |
| Created timestamp | `api-key-created` |
| Last used timestamp | `api-key-last-used` |
| Revoke control | `api-key-revoke` |

HTTP:

- Header: `Authorization: Bearer <key>` (identifier `header:authorization-bearer`).
- 401 body exactly `{"error":"unauthorized"}`.

## Brownfield constraints

- Do not replace the legacy session module; cookie sessions remain how the UI signs in.
- Existing smoke (sign-in, add item, tag filter, `/api/items` with cookie) must stay green.
- Do not change the `playwright` compose service, Playwright version, or `test/smoke/`.
- No new runtime dependency unless the brief cannot be met without it.

## Out of scope

- OAuth, cookies-as-keys, per-key scopes, rate limits, admin UI for other users' keys, rotating a key (that is F1').


---- read only after done-f1 ----

## features/F1-prime.md

# F1' — rotate keys

A follow-up on the same API keys: Settings gets Rotate per key so the user can mint a new secret for the same key without creating a second row.

## Intent

After F1 has shipped, a user needs to replace a leaked secret. Rotate keeps the same key record (same id and name), shows the new secret once, and retires the old secret immediately. last rotated is shown after rotation.

## Acceptance criteria (prose)

1. Rotate keeps id and name and shows the new secret once (`api-key-plaintext`).
2. The old secret fails immediately (401 `{"error":"unauthorized"}`); the new secret works on `Authorization: Bearer`.
3. last rotated is shown after rotation (`api-key-last-rotated`).

## Interface contract

| Control | `data-testid` |
|---|---|
| Rotate | `api-key-rotate` |
| last rotated | `api-key-last-rotated` |

The 401 body and `Authorization: Bearer` header stay as in F1.

## Out of scope

- Per-key read-only scope, multiple concurrent secrets, renaming a key.


gatekit clone URL placeholder: <GATEKIT_URL>
arm=spec-kit n=2
