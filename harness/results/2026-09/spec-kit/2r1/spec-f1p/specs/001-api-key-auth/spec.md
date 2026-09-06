# Feature Specification: API-key authentication

**Feature Branch**: `001-api-key-auth`

**Created**: 2026-09-06

**Status**: Draft

**Input**: User description: "A signed-in user of Shelfmark can create a named API key in Settings and use it as a Bearer token so that the JSON API authenticates without a cookie."

## Clarifications

### Session 2026-09-06

- Q: How should `/api/*` choose a credential when both a Bearer header and a session cookie are present? → A: Bearer is exclusive for `/api/*`; a bad Bearer yields 401 even with a valid cookie. HTML routes keep using the cookie only.
- Q: What visible format should a listed key use for the secret and timestamps? → A: Prefix plus masked tail in the list; full secret once at create; timestamps as `YYYY-MM-DD` from stored UTC.
- Q: Should an empty key name be allowed? → A: Reject empty or whitespace-only names; create nothing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a named API key (Priority: P1)

A signed-in reader opens Settings, types a name, and creates an API key. The app shows the full secret once. After a reload, that plaintext is gone; the key still appears in the list with its name and created date.

**Why this priority**: Without a created secret, no script can authenticate. This is the whole feature's entry point.

**Independent Test**: Sign in, open Settings, create a key named "cli", confirm a non-empty one-time secret is visible, reload, confirm the secret is hidden and a row still lists the name and created date.

**Acceptance Scenarios**:

1. **Given** a signed-in user on Settings, **When** they submit a name and create a key, **Then** a one-time plaintext secret is shown and is non-empty.
2. **Given** that plaintext was just shown, **When** Settings is reloaded, **Then** the plaintext is not shown and a listed key row still includes the name and a created timestamp.

---

### User Story 2 - Call the JSON API with the secret (Priority: P1)

The same user (or a script acting as them) sends `Authorization: Bearer` plus the secret to `GET /api/items` with no cookie. The response is 200 with `items` and `count`, including an item they created in the UI.

**Why this priority**: This is the stated intent — scripts must stop fishing a browser cookie.

**Independent Test**: Create an item in the UI, create a key, call `GET /api/items` with only the Bearer secret, confirm 200 and that the item is present.

**Acceptance Scenarios**:

1. **Given** a valid secret for the signed-in user and an item they created, **When** `GET /api/items` is called with `Authorization: Bearer <secret>` and no cookie, **Then** the status is 200, the body has `items` and `count`, and the created item is included.
2. **Given** a request to `/api/*` with no Authorization header, **When** no valid session cookie is present either, **Then** the status is 401 and the body is exactly `{"error":"unauthorized"}`.
3. **Given** `Authorization: Bearer not-a-key`, **When** `GET /api/items` is called, **Then** the status is 401 and the body is exactly `{"error":"unauthorized"}`.

---

### User Story 3 - Cookie sessions still work (Priority: P1)

The browser session is unchanged. A signed-in visitor can still load `/items` and `GET /api/items` with the cookie.

**Why this priority**: Existing smoke must stay green; the UI must not start requiring keys.

**Independent Test**: Sign in through the form, open `/items` and see item rows, `GET /api/items` with the session cookie and receive 200.

**Acceptance Scenarios**:

1. **Given** a valid browser session, **When** the user visits `/items`, **Then** item rows still render.
2. **Given** a valid browser session, **When** `GET /api/items` is called with the session cookie and no Bearer header, **Then** the status is 200.

---

### User Story 4 - Last used and immediate revoke (Priority: P2)

After a successful Bearer call, Settings shows when the key was last used. Revoking the key makes that secret fail immediately.

**Why this priority**: Operators need to see use and cut off a leaked secret; it is required by the brief but depends on create and auth already working.

**Independent Test**: Use the key once, reload Settings, see last-used; revoke; the same secret then returns 401 with the exact unauthorized body.

**Acceptance Scenarios**:

1. **Given** a key that has authenticated at least one `/api/*` request, **When** Settings is viewed, **Then** last used is shown on that key's row.
2. **Given** a listed key, **When** the user revokes it, **Then** the same secret immediately returns 401 with body `{"error":"unauthorized"}`.

---

### Edge Cases

- Empty or whitespace-only key name is rejected; no key is created.
- A revoked or unknown secret never authenticates, including after a process restart (persisted store).
- If both a Bearer header and a session cookie are sent, Bearer is the only credential considered for `/api/*`; a bad Bearer yields 401 even if the cookie is valid.
- Cookie sessions for HTML pages ignore Bearer; Settings and `/items` still use the cookie.
- Last used is absent until the key has authenticated at least once.
- Creating several named keys lists each as its own row, newest first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A signed-in user MUST be able to create a named API key from Settings.
- **FR-002**: After create, the UI MUST show the full plaintext secret exactly once (`api-key-plaintext`). Reloading Settings MUST hide that plaintext.
- **FR-003**: The plaintext MUST be a non-empty secret: a short prefix plus a random secret with at least 32 random bytes before encoding.
- **FR-004**: Each listed key row (`api-key-row`) MUST show the name and a created timestamp (`api-key-created`) as an ISO-8601 date `YYYY-MM-DD`. Internally timestamps are UTC.
- **FR-005**: The list MUST show a prefix and masked tail for the secret, not the full plaintext.
- **FR-006**: Settings MUST include a section labeled “API keys” (`api-keys-section`) that explains the secret is shown once and that revoke is immediate. Controls: name field `api-key-name`, create `api-key-create`, revoke `api-key-revoke`, last used `api-key-last-used`.
- **FR-007**: `GET /api/items` with `Authorization: Bearer <key>` and a valid secret MUST return 200 with `items` and `count` as that owning user, without a cookie.
- **FR-008**: Missing Authorization, or `Authorization: Bearer not-a-key`, MUST return 401 with the exact body `{"error":"unauthorized"}`.
- **FR-009**: Valid cookie sessions MUST continue to authenticate HTML and `GET /api/items` without a Bearer header.
- **FR-010**: After a successful Bearer authentication, last used MUST be shown on the key row.
- **FR-011**: Revoke MUST take effect immediately for that secret.
- **FR-012**: Key rows MUST be listed newest first (same ordering idea as `/items`).
- **FR-013**: Bearer authentication MUST apply to `/api/*` as the owning user, not only the items list endpoint.

### Interface contract

These locators are the acceptance surface:

| Control | `data-testid` |
|---|---|
| Settings keys section | `api-keys-section` |
| Name field | `api-key-name` |
| Create key button | `api-key-create` |
| One-time plaintext | `api-key-plaintext` |
| A listed key row | `api-key-row` |
| Created timestamp | `api-key-created` |
| Last used timestamp | `api-key-last-used` |
| Revoke control | `api-key-revoke` |

HTTP: header `Authorization: Bearer <key>` (identifier `header:authorization-bearer`). 401 body exactly `{"error":"unauthorized"}`.

### Key Entities

- **API key**: Named credential owned by one user. Attributes: id, name, secret prefix, created time, last-used time (optional until first use), revoked or active. The full secret is known only at create time; later checks use a stored verifier, not the plaintext.
- **User**: Existing Shelfmark account. Cookie session and API keys both identify this same user for `/api/*`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in user can create a named key and copy a non-empty secret in a single Settings visit, without leaving the page.
- **SC-002**: After reload, 100% of listed keys show name and created date and 0% still show the one-time plaintext.
- **SC-003**: A script using only the Bearer secret can read the user's items, including an item created in the UI, on the first try.
- **SC-004**: Invalid or missing Bearer credentials always return the same unauthorized JSON body; no HTML error page.
- **SC-005**: Existing browser sign-in, item list, and cookie-authenticated item fetch continue to work for the seeded demo account.
- **SC-006**: After revoke, the old secret fails on the next request (no delay, no second chance).

## Assumptions

- Rotation of a key (new secret, same row) is out of scope for this feature.
- OAuth, cookies-as-keys, per-key scopes, rate limits, and admin UI for other users' keys are out of scope.
- The existing seeded user `demo` / `demo-pass-1234` is sufficient for manual and scripted checks.
- Empty name is invalid; names are otherwise free-form trimmed strings.
- No new runtime dependency is required; Node `crypto` is enough for secret generation and hashing.

## Out of Scope

- OAuth, cookies-as-keys, per-key scopes, rate limits, admin UI for other users' keys, rotating a key.
