# Product Definition

## Title

Shelfmark

## Summary

Shelfmark is a small reading-list web app: a signed-in user pastes a URL, adds a note and a few tags, and later finds that link by tag or by a word in the title. It is a brownfield fixture — enough real code and history to carry project habits, including two legacy CommonJS modules that newer TypeScript must wrap rather than rewrite.

## Users

A single seeded operator (`demo`) uses the app for personal link saving. There is no public registration. Scripts are a second consumer of the JSON API and today must borrow a browser session cookie; API keys are the intended replacement for that path.

## Core capabilities

- Sign in with a username and password. Sessions live in a signed cookie (`shelfmark.sid`) and in-memory store; they do not survive process restart.
- Create, edit, and delete items. An item is a URL, a title, an optional note, and up to ten tags.
- Browse items at `/items`, newest first, filtered by an exact tag (`?tag=`) or a substring of title, URL, or note (`?q=`).
- Change the account password from Settings.
- Call a JSON API at `/api/items` (list/create) and `/api/items/:id` (fetch/delete). Writes require `Content-Type: application/json`. Unauthenticated API calls return exactly `{"error":"unauthorized"}`.
- Health check at `GET /healthz`.

## Authentication product rules

- Cookie sessions remain how the UI signs in. Do not replace the legacy session module.
- Named API keys (when present) authenticate `/api/*` as the owning user via `Authorization: Bearer <secret>`.
- API key display: a short prefix plus a random secret. List rows show the prefix and a masked tail; full plaintext is shown once at create. Revoke is immediate.
- Key entropy: at least 32 random bytes before encoding.
- Settings copy: section labelled “API keys”; explain that the secret is shown once and that revoke is immediate.
- Timestamps in the UI: ISO-8601 date (`YYYY-MM-DD`) for created and last-used; store UTC internally.
- Item list ordering: newest first (same as existing `/items`).

## Out of product scope (unless a track explicitly adds them)

OAuth, cookies-as-keys, per-key scopes, rate limits, admin UI for other users' keys, and (until a dedicated follow-up) rotating a key.

## Constraints

- Team size 1. No CI. Local Docker and Make targets only (`make smoke`, `make test-docker`).
- No new runtime dependency unless a track cannot be met without it.
- Sign-in for manual and scripted use: username `demo`, password `demo-pass-1234`.
