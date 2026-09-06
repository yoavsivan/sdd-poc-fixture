# Feature Specification: Rotate API keys

**Feature Branch**: `002-rotate-api-keys`

**Created**: 2026-09-06

**Status**: Draft

**Input**: User description: "Settings gets Rotate per key so the user can mint a new secret for the same key without creating a second row."

## Clarifications

### Session 2026-09-06

- Q: Does rotate keep the same key id and name? → A: Yes. Same record; only the secret changes.
- Q: When is last rotated shown? → A: After a successful rotate, as `YYYY-MM-DD` (`api-key-last-rotated`).
- Q: Concurrent secrets? → A: Out of scope. The old secret fails immediately; only the new one works.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rotate keeps identity and shows the new secret once (Priority: P1)

A signed-in user with an existing named key clicks Rotate. The same row (same id and name) remains. The new secret is shown once. Reload hides the plaintext.

**Why this priority**: This is the whole follow-up: replace a leaked secret without a second row.

**Independent Test**: Create a key named "cli", rotate it, confirm plaintext is new and non-empty, name still "cli", one row only.

**Acceptance Scenarios**:

1. **Given** a listed key, **When** the user rotates it, **Then** the one-time plaintext (`api-key-plaintext`) is a new non-empty secret and the row still has the same name.
2. **Given** a rotation just succeeded, **When** Settings is reloaded, **Then** the plaintext is hidden and there is still a single row for that name.

---

### User Story 2 - Old secret dies; new secret works (Priority: P1)

After rotate, `Authorization: Bearer` with the old secret returns 401 `{"error":"unauthorized"}`. The new secret authenticates `/api/*`.

**Why this priority**: Rotation is useless if the leaked secret still works.

**Independent Test**: Capture secret A, rotate, A → 401 exact body; secret B → 200 on `GET /api/items`.

**Acceptance Scenarios**:

1. **Given** secret A for a key, **When** that key is rotated, **Then** Bearer A returns 401 with body `{"error":"unauthorized"}`.
2. **Given** the new secret B after rotate, **When** `GET /api/items` is called with `Authorization: Bearer B` and no cookie, **Then** status is 200.

---

### User Story 3 - Last rotated is shown (Priority: P2)

After rotation, the row shows last rotated as an ISO-8601 date.

**Why this priority**: Operators need to see that rotation happened.

**Independent Test**: Rotate, reload Settings, `api-key-last-rotated` matches `YYYY-MM-DD`.

**Acceptance Scenarios**:

1. **Given** a key that has been rotated, **When** Settings is viewed, **Then** last rotated (`api-key-last-rotated`) is shown as `YYYY-MM-DD`.
2. **Given** a key that has never been rotated, **When** Settings is viewed, **Then** last rotated is not shown.

---

### Edge Cases

- Rotate on a missing or already-revoked key is not found.
- Rotate requires a signed-in session and CSRF, like revoke.
- Rename is out of scope; name is unchanged.
- Multiple concurrent secrets for one row are out of scope.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Settings MUST offer Rotate per key (`api-key-rotate`).
- **FR-002**: Rotate MUST keep the same key id and name.
- **FR-003**: Rotate MUST mint a new secret and show it once (`api-key-plaintext`).
- **FR-004**: The previous secret MUST fail immediately with 401 `{"error":"unauthorized"}`.
- **FR-005**: The new secret MUST authenticate `Authorization: Bearer` on `/api/*`.
- **FR-006**: After rotation, last rotated MUST be shown (`api-key-last-rotated`) as `YYYY-MM-DD` from stored UTC.
- **FR-007**: Rotate MUST NOT create a second row for the same key.

### Interface contract

| Control | `data-testid` |
|---|---|
| Rotate | `api-key-rotate` |
| last rotated | `api-key-last-rotated` |

401 body and Bearer header stay as in F1.

### Key Entities

- **API key** (existing): gains an optional last-rotated timestamp. Secret verifier is replaced in place.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can replace a leaked secret without creating another named row.
- **SC-002**: After rotate, 100% of requests with the old secret are unauthorized; the new secret succeeds on the next call.
- **SC-003**: After rotate, last rotated is visible as a calendar date.

## Assumptions

- F1 create/list/revoke/Bearer behavior remains.
- Per-key read-only scope, multiple concurrent secrets, and renaming are out of scope.
- UI timestamps stay `YYYY-MM-DD`.

## Out of Scope

- Per-key read-only scope, multiple concurrent secrets, renaming a key.
