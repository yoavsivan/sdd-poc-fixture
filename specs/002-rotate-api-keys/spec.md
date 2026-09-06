# Feature Specification: Rotate API keys

**Feature Branch**: `002-rotate-api-keys`

**Created**: 2026-09-06

**Status**: Implemented

**Input**: User description: "Settings gets Rotate per key so the user can mint a new secret for the same key without creating a second row."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rotate keeps identity and shows the new secret once (Priority: P1)

A signed-in user with an existing API key clicks Rotate on that row. The key keeps the same id and name. A new secret is shown once (`api-key-plaintext`). Reloading hides the plaintext. There is still a single row.

**Why this priority**: This is the whole follow-up — replace a leaked secret without a second key.

**Independent Test**: Create a key, note id and name, rotate, confirm same id and name, plaintext shown, reload hides it, still one row.

**Acceptance Scenarios**:

1. **Given** an existing named key, **When** the owner rotates it, **Then** the same row (same id and name) remains and a new non-empty plaintext is shown once.
2. **Given** that new plaintext was shown, **When** Settings is reloaded, **Then** `api-key-plaintext` is absent and the row is still the same key.

---

### User Story 2 - Old secret dies; new secret works (Priority: P1)

After rotate, the previous Bearer secret returns 401 `{"error":"unauthorized"}` immediately. The new secret authenticates `Authorization: Bearer` on `/api/*`.

**Why this priority**: Rotation is useless if the leaked secret still works.

**Independent Test**: Capture old secret, rotate, old Bearer 401 exact body, new Bearer 200.

**Acceptance Scenarios**:

1. **Given** a key whose old secret previously worked, **When** it is rotated, **Then** the old secret immediately returns 401 with body exactly `{"error":"unauthorized"}`.
2. **Given** the new secret from that rotation, **When** a client calls `GET /api/items` with `Authorization: Bearer <new-secret>` and no cookie, **Then** the status is 200.

---

### User Story 3 - Last rotated is shown (Priority: P2)

After rotation, the row shows last rotated (`api-key-last-rotated`) as `YYYY-MM-DD`.

**Why this priority**: The owner needs proof the rotation happened.

**Independent Test**: Rotate, reload Settings, locator present with an ISO date.

**Acceptance Scenarios**:

1. **Given** a key that has been rotated, **When** Settings renders, **Then** `api-key-last-rotated` shows a `YYYY-MM-DD` date.

---

### Edge Cases

- Rotate on a revoked key is a no-op (key is not listed).
- Rotate requires the signed-in owner; CSRF as other settings posts.
- Last used is unchanged by rotation unless the new secret is used.
- No second concurrent secret: only the new hash authenticates.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Settings MUST offer a Rotate control (`data-testid="api-key-rotate"`) on each active key row.
- **FR-002**: Rotate MUST keep the same key id and name (no second row).
- **FR-003**: Rotate MUST mint a new secret, show it once via `api-key-plaintext`, and store only the new hash.
- **FR-004**: The previous secret MUST fail immediately with 401 `{"error":"unauthorized"}`.
- **FR-005**: The new secret MUST authenticate `Authorization: Bearer` on `/api/*` as the owning user.
- **FR-006**: After rotation, last rotated MUST be shown (`data-testid="api-key-last-rotated"`) as `YYYY-MM-DD` (UTC stored internally).

### Key Entities

- **API key**: Same entity as F1, plus optional last-rotated time. Rotation replaces the secret in place.

### Interface contract

| Control | `data-testid` |
|---|---|
| Rotate | `api-key-rotate` |
| last rotated | `api-key-last-rotated` |

401 body and Bearer header stay as in F1.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After one rotate action, the user still has one key with the same name and a new secret shown once.
- **SC-002**: The retired secret cannot fetch items; the new secret can, without a cookie.
- **SC-003**: The owner can see a last-rotated date on that key after rotating.

## Assumptions

- Rotation is in-place; no rename; no multiple concurrent secrets; no per-key scopes.
- Display dates remain ISO-8601 `YYYY-MM-DD`; store UTC.
- Cookie sessions and create/revoke behavior from F1 remain.

## Out of Scope

- Per-key read-only scope, multiple concurrent secrets, renaming a key.
