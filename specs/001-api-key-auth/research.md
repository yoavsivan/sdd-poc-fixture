# Research: API-key authentication

## Secret storage and lookup

- Decision: Store `sha256(plaintext)` as a unique `token_hash` (hex). Lookup by hash. Never persist plaintext after create.
- Rationale: Secrets have ≥32 random bytes; SHA-256 is appropriate and uses Node `crypto` (no new dependency). scrypt (password hasher) is too slow per API request.
- Alternatives considered: scrypt per request (rejected: latency); store plaintext (rejected: leak on DB read); HMAC with server secret (unnecessary extra coupling).

## Secret display format

- Decision: Plaintext `smk_<8-hex-prefix>_<43-char-base64url>` where the body is 32 random bytes (base64url, no pad). List shows `smk_<prefix>_••••<last4>`.
- Rationale: Matches product (prefix + random secret; prefix and masked tail in the list). 32 bytes before encoding meets entropy requirement.
- Alternatives considered: hex-only body (longer); UUID as prefix (heavier).

## Where Bearer is honored

- Decision: Parse `Authorization: Bearer` only when the request path is `/api` or `/api/*`. HTML routes keep cookie-only `loadUser`.
- Rationale: Brief: keys authenticate `/api/*`. Cookie sessions remain how the UI signs in.
- Alternatives considered: Bearer on all routes (would bypass CSRF/UI session; out of scope).

## Dual credentials

- Decision: If a Bearer header is present on `/api/*`, it is decisive. Valid key → owner. Invalid/revoked/malformed → user unset → `requireApiUser` 401. Cookie is ignored when Bearer is present.
- Rationale: HUMAN.md clarify + spec edge case. Scripts must not fall through to a browser cookie.
- Alternatives considered: Cookie wins if Bearer invalid (rejected: masks bad keys).

## Last used

- Decision: On successful Bearer auth, set `last_used_at` to UTC ISO timestamp. Display `YYYY-MM-DD` (first 10 chars of ISO date, UTC).
- Rationale: Product timestamps. Single UPDATE after lookup.
- Alternatives considered: debounce last-used (unnecessary at this scale).

## Revoke

- Decision: Set `revoked_at` (UTC ISO). Lookup requires `revoked_at IS NULL`. Hide revoked rows from Settings list.
- Rationale: Immediate 401; smallest UI change. Row does not linger.
- Alternatives considered: DELETE row (also fine; soft revoke keeps audit of last used until F1' rotation). Soft revoke chosen so F1' can reuse the same id.

## Settings create UX

- Decision: POST `/settings/api-keys` (CSRF as other settings forms), store plaintext once in `session.data.apiKeyPlaintext`, redirect GET `/settings`, render `api-key-plaintext`, then clear the session field.
- Rationale: Reload hides plaintext. Extends SessionData types only; does not rewrite session.cjs.
- Alternatives considered: re-render POST without redirect (weaker reload story).

## Tests

- Decision: Add Vitest cases for create/list/hide plaintext, Bearer 200 without cookie, 401 exact body, last-used, revoke. Keep existing smoke unmodified.
- Rationale: Constitution Docker-first; existing smoke must stay 4 passed. Acceptance tests (harness) are not in this tree.
- Alternatives considered: Playwright additions in test/smoke (forbidden).
