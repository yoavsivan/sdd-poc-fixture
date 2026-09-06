# Spec: Rotate API keys

## Overview

After named API keys have shipped, Settings gains Rotate per key. Rotate mints a new secret for the same key record (same id and name), shows the new secret once, and retires the old secret immediately. Last rotated is shown after rotation.

## Functional requirements

1. Each `api-key-row` has a Rotate control (`data-testid="api-key-rotate"`).
2. Rotate keeps the same database id and name.
3. After rotate, the new plaintext is shown once (`api-key-plaintext`). Reload hides it.
4. The old secret fails immediately: `Authorization: Bearer` returns 401 `{"error":"unauthorized"}`.
5. The new secret authenticates `/api/*` as the owning user.
6. After rotation, last rotated is shown (`data-testid="api-key-last-rotated"`) as `YYYY-MM-DD` (UTC stored internally).

## Acceptance criteria

1. Rotate keeps id and name and shows the new secret once (`api-key-plaintext`).
2. The old secret fails immediately (401 `{"error":"unauthorized"}`); the new secret works on `Authorization: Bearer`.
3. last rotated is shown after rotation (`api-key-last-rotated`).

## Interface contract

| Control | `data-testid` |
|---|---|
| Rotate | `api-key-rotate` |
| last rotated | `api-key-last-rotated` |

401 body and `Authorization: Bearer` stay as in F1.

## Out of scope

Per-key read-only scope, multiple concurrent secrets, renaming a key.
