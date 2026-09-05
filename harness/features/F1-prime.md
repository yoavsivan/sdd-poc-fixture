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
