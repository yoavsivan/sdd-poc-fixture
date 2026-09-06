# Research: API-key authentication

## Decision 1: Secret format and storage

- **Choice**: Plaintext `smk_` + base64url(32 random bytes). Store SHA-256 hex of the full plaintext. Display prefix = first 8 characters; masked tail = last 4 characters.
- **Rationale**: Meets ≥32 random bytes before encoding, Node `crypto` only, lookup by hash (constant time compare via unique index + exact match). Prefix is not secret.
- **Rejected**: bcrypt (unnecessary for high-entropy secrets; extra work). Storing plaintext (leaks on disk). UUID-only keys (weaker display story).

## Decision 2: Bearer vs cookie

- **Choice**: On `/api/*`, if `Authorization` starts with `Bearer `, authenticate only with that secret (success → owning user; failure → no user → 401). Otherwise keep cookie `loadUser`. HTML routes ignore Bearer.
- **Rationale**: HUMAN.md: cookie sessions unchanged; extend JSON API rather than a parallel stack. Existing `Bearer anything` unit test stays 401.
- **Rejected**: Accepting either when both present (a stolen cookie could mask a revoked key). Mixing credentials.

## Decision 3: Create UX (show secret once)

- **Choice**: `POST /settings/api-keys` re-renders Settings with `plaintext` for the new key. `GET /settings` never includes plaintext. Revoke is `POST /settings/api-keys/:id/revoke` with CSRF like the password form.
- **Rationale**: Redirect-after-POST cannot safely carry the secret. Matches “shown once”.
- **Rejected**: Session-flash of the secret (lingers, logs). Dedicated success page (new surface).

## Decision 4: Last used

- **Choice**: Set `last_used_at` to UTC ISO when a Bearer secret is accepted, before the route handler.
- **Rationale**: “After the key is used” means successful authentication, even if the later route 404s.
