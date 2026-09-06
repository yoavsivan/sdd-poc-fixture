# Specification: Rotate API keys (F1')

## Overview

Follow-up on named API keys. Settings gains **Rotate** per key so a user can
replace a leaked secret without creating a second row. The same key record
(same id and name) receives a new secret, shown once; the old secret fails
immediately.

## Functional Requirements

1. **Rotate keeps identity.** Rotating a key keeps `id` and `name`. The UI
   shows the new secret once (`data-testid="api-key-plaintext"`).
2. **Old secret dies.** The previous secret then returns 401
   `{"error":"unauthorized"}` on `Authorization: Bearer`. The new secret
   authenticates `/api/*` as the owning user.
3. **Last rotated.** After rotation, last rotated is shown
   (`data-testid="api-key-last-rotated"`) as `YYYY-MM-DD`.

## Interface contract

| Control | `data-testid` |
|---|---|
| Rotate | `api-key-rotate` |
| last rotated | `api-key-last-rotated` |

The 401 body and `Authorization: Bearer` header stay as in F1.

## Non-Functional Requirements

- Same storage and hashing as F1. No new runtime dependency.
- Do not rewrite legacy session/query modules.
- Tests in containers (`make test-docker`, `make smoke`).

## Acceptance Criteria

1. Rotate keeps id and name and shows the new secret once (`api-key-plaintext`).
2. The old secret fails immediately (401 `{"error":"unauthorized"}`); the new secret works on `Authorization: Bearer`.
3. last rotated is shown after rotation (`api-key-last-rotated`).

## Out of Scope

- Per-key read-only scope, multiple concurrent secrets, renaming a key.
