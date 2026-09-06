# Shelfmark

Shelfmark is a small web app for saving links with notes and tags. A signed-in user pastes a URL, adds a note and a few tags, and later finds the link by tag or by a word in the title.

It is a brownfield reading-list fixture: enough real code to carry project history, with cookie sessions for the UI and a JSON API at `/api/items`. Sign-in uses the seeded account `demo` / `demo-pass-1234`. Named API keys in Settings authenticate `/api/*` as the owning user with `Authorization: Bearer`.

## Users

A single operator (team size 1) using the app locally. Scripts talk to the JSON API. There is no registration form; one seeded user is enough.

## Core capabilities

- Sign in with a username and password. Sessions live in a signed cookie (`shelfmark.sid`) and in-memory store.
- Save, edit, delete, and filter items (URL, title, optional note, up to ten tags).
- HTML UI at `/items` and `/settings`. Newest items first.
- JSON API for items. Cookie sessions remain how the UI signs in. API keys, when added, authenticate `/api/*` as the owning user without a cookie.
- Settings for the account, password change, named API keys, and rotating a key in place (same id and name).

## Constraints

- Wrap `src/legacy/session.cjs` and `src/legacy/query.cjs`; do not rewrite those modules.
- No new runtime dependency unless a brief cannot be met without it.
- Existing smoke (sign-in, add item, tag filter, `/api/items` with cookie) must stay green.
