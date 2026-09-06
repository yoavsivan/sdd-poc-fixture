# Research: Rotate API keys

## In-place secret replacement

- Decision: UPDATE the existing `api_keys` row: new prefix, suffix, token_hash, rotated_at. Do not INSERT a second row. Do not keep the old hash.
- Rationale: Brief: same id and name; old secret fails immediately; no concurrent secrets.
- Alternatives considered: two-row history (out of scope); grace period dual secrets (out of scope).

## Last rotated

- Decision: `rotated_at` TEXT UTC ISO; UI `YYYY-MM-DD`. NULL until first rotate.
- Rationale: Matches F1 timestamp pattern. Show locator only after rotation.
- Alternatives considered: reuse last_used_at (rejected: different meaning).

## One-time plaintext

- Decision: Reuse `session.data.apiKeyPlaintext` after rotate, same as create.
- Rationale: Same locator `api-key-plaintext`; least surface.
- Alternatives considered: separate session key (unnecessary).
