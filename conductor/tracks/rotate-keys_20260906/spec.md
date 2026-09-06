# Spec: Rotate API keys

## Overview

A signed-in user can rotate an existing API key from Settings. Rotate keeps the same key record (same id and name), mints a new secret, shows that secret once, and retires the old secret immediately. After rotation, last rotated is shown.

## Functional Requirements

1. Each listed key has a Rotate control (`api-key-rotate`).
2. Rotate keeps `id` and `name`, replaces the stored secret hash, and shows the new plaintext once (`api-key-plaintext`).
3. The previous secret then fails `Authorization: Bearer` with 401 `{"error":"unauthorized"}`. The new secret succeeds.
4. After rotation, last rotated is shown (`api-key-last-rotated`) as `YYYY-MM-DD`. Store UTC internally.
5. Reloading Settings hides the new plaintext, same as create.

## Non-Functional Requirements

- Same storage and hashing as F1. No new runtime dependency.
- Do not rewrite legacy session or query modules.
- Cookie sessions unchanged. 401 body and Bearer header stay as in F1.
- Tests run in Docker (`make test-docker`, `make smoke`).

## Acceptance Criteria

1. Rotate keeps id and name and shows the new secret once (`api-key-plaintext`).
2. The old secret fails immediately (401 `{"error":"unauthorized"}`); the new secret works on `Authorization: Bearer`.
3. last rotated is shown after rotation (`api-key-last-rotated`).

## Interface Contract

| Control | `data-testid` |
|---|---|
| Rotate | `api-key-rotate` |
| last rotated | `api-key-last-rotated` |

The 401 body and `Authorization: Bearer` header stay as in F1.

## Out of Scope

- Per-key read-only scope
- Multiple concurrent secrets
- Renaming a key
