# Feature Specification: API-key authentication

**Feature Branch**: `001-api-key-auth`

**Created**: 2026-09-06

**Status**: Implemented

**Input**: User description: "A signed-in user of Shelfmark can create a named API key in Settings and use it as a Bearer token so that the JSON API authenticates without a cookie."

## Clarifications

### Session 2026-09-06

- Q: When a JSON API request includes both a session cookie and a Bearer token, which credential should win? → A: Bearer is decisive: a valid key authenticates as the owner; an invalid key is 401 even if a cookie is present.
- Q: What should the Settings keys section be labeled and explain? → A: Label “API keys”; explain the secret is shown once and revoke is immediate.
- Q: How should timestamps appear? → A: Store UTC internally; show ISO-8601 date `YYYY-MM-DD` for created and last used.
- Q: Key list order and secret strength? → A: Newest first; at least 32 random bytes before encoding; list shows prefix plus masked tail.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a named API key (Priority: P1)

A signed-in user opens Settings, names a new API key, and creates it. The full secret is shown once. After a reload, the secret is gone from the page and the key appears in a list with its name and created date.

**Why this priority**: Without create-and-show-once, no script can obtain a credential.

**Independent Test**: Sign in, open Settings, create a key named e.g. "scripts", confirm a non-empty one-time secret appears, reload Settings, confirm the secret is hidden and a row still lists the name and created timestamp.

**Acceptance Scenarios**:

1. **Given** a signed-in user on Settings, **When** they enter a name and create a key, **Then** a one-time plaintext secret is shown and is non-empty.
2. **Given** that secret was just shown, **When** the user reloads Settings, **Then** the plaintext is not shown and a listed key row still shows the name and created timestamp.
3. **Given** the keys section on Settings, **When** the page renders, **Then** the section is labeled “API keys”, explains that the secret is shown once, and that revoke is immediate.

---

### User Story 2 - Call the JSON API with the secret (Priority: P1)

A script sends `Authorization: Bearer <secret>` to `GET /api/items` with no cookie. The response is 200 with `items` and `count`, and includes an item that user created in the UI.

**Why this priority**: This is the reason keys exist — scripts must authenticate as the owning user without fishing a session cookie.

**Independent Test**: Create an item in the UI, create a key, call `GET /api/items` with only the Bearer secret, and confirm 200 plus that item.

**Acceptance Scenarios**:

1. **Given** a user who created an item in the UI and a valid key secret, **When** a client calls `GET /api/items` with `Authorization: Bearer <secret>` and no cookie, **Then** the status is 200 and the body has `items` and `count` including that item.
2. **Given** the same user signed in with a cookie, **When** they `GET /api/items` with the cookie and no Bearer header, **Then** they still receive 200 and `/items` still renders item rows.

---

### User Story 3 - Reject invalid callers (Priority: P1)

A caller without a valid credential cannot read the JSON API. Missing header, or `Authorization: Bearer not-a-key`, returns 401 with the exact body `{"error":"unauthorized"}`.

**Why this priority**: Security floor; existing cookie-less 401 behavior must stay exact.

**Independent Test**: Call `GET /api/items` with no Authorization and with Bearer `not-a-key`; both must be 401 with that exact JSON body.

**Acceptance Scenarios**:

1. **Given** no Authorization header and no valid session cookie, **When** a client calls `GET /api/items`, **Then** the response is 401 with body exactly `{"error":"unauthorized"}`.
2. **Given** `Authorization: Bearer not-a-key`, **When** a client calls `GET /api/items` without a cookie, **Then** the response is 401 with body exactly `{"error":"unauthorized"}`.

---

### User Story 4 - Last used and immediate revoke (Priority: P2)

After a key is used successfully, Settings shows last used. The owner can revoke the key; the same secret then returns 401 with the exact unauthorized body.

**Why this priority**: Needed to retire a leaked or unused secret without deleting the user's account.

**Independent Test**: Use the secret once, reload Settings, confirm last used; revoke; call the API with the same secret and expect 401.

**Acceptance Scenarios**:

1. **Given** a key that has been used on `/api/*`, **When** the owner reloads Settings, **Then** last used is shown for that row.
2. **Given** a listed key, **When** the owner revokes it, **Then** the same secret immediately returns 401 with body exactly `{"error":"unauthorized"}`.

---

### Edge Cases

- Empty or whitespace-only key name is rejected; no key is created and no secret is shown.
- Two keys for the same user may share a display name; they remain distinct rows.
- A revoked key never authenticates again, even if the secret string is replayed.
- A valid session cookie still authenticates `/api/*` when no Bearer header is sent.
- If both a cookie and a Bearer header are present, a valid Bearer authenticates as the key owner; an invalid Bearer is unauthorized even if a cookie is present (scripts must not accidentally fall through to a browser session).
- Keys belong only to the creating user; another user's secret does not list this user's items.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A signed-in user MUST be able to create a named API key from Settings.
- **FR-002**: After create, the system MUST show the full plaintext secret exactly once (`data-testid="api-key-plaintext"`). Reloading Settings MUST hide that plaintext.
- **FR-003**: The secret MUST have enough entropy for a bearer secret (at least 32 random bytes before encoding) and a short prefix so the list can show prefix plus a masked tail.
- **FR-004**: Each listed key row (`data-testid="api-key-row"`) MUST show the name and a created timestamp (`data-testid="api-key-created"`) as an ISO-8601 date `YYYY-MM-DD`.
- **FR-005**: Settings MUST include a keys section (`data-testid="api-keys-section"`) labeled “API keys”, with name field `api-key-name`, create control `api-key-create`, and copy explaining that the secret is shown once and that revoke is immediate.
- **FR-006**: `GET /api/items` with `Authorization: Bearer <secret>` and no cookie MUST authenticate as the owning user, return 200 with `items` and `count`, and include items that user created in the UI.
- **FR-007**: Bearer authentication MUST apply to `/api/*` as the owning user. Cookie sessions MUST remain how the UI signs in; the legacy session behavior MUST stay in place.
- **FR-008**: Missing Authorization (and no valid session), or `Authorization: Bearer not-a-key`, MUST return 401 with the exact body `{"error":"unauthorized"}`.
- **FR-009**: After a successful Bearer use, Settings MUST show last used (`data-testid="api-key-last-used"`) as `YYYY-MM-DD`.
- **FR-010**: A revoke control (`data-testid="api-key-revoke"`) MUST immediately retire the secret so the same Bearer value returns 401 with the exact unauthorized body.
- **FR-011**: Key list ordering MUST be newest first (same as existing `/items`).
- **FR-012**: Created and last-used instants MUST be stored in UTC internally and displayed as ISO-8601 dates.

### Key Entities

- **API key**: Belongs to one user. Has a display name, a created time, optional last-used time, a prefix for list display, and a secret that is shown once at create and stored only in a non-reversible form after that. Revoked keys do not authenticate.
- **User**: Existing Shelfmark account. Cookie session and API keys both represent this user on `/api/*`.

### Interface contract

These locators are part of the product contract, not optional styling:

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

HTTP:

- Header: `Authorization: Bearer <key>` (identifier `header:authorization-bearer`).
- 401 body exactly `{"error":"unauthorized"}`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in user can create a named key and see a non-empty secret in one Settings visit; a reload no longer shows that secret.
- **SC-002**: A caller using only the secret can retrieve that user's items, including one created in the UI, in a single request.
- **SC-003**: Callers with no secret or a bogus secret never receive item data; they receive the same unauthorized response the product already uses for unsigned API calls.
- **SC-004**: After revoke, the retired secret fails on the next request with that same unauthorized response.
- **SC-005**: Existing signed-in browser flows still list items in the UI and via the cookie-authenticated JSON API.
- **SC-006**: After the first successful secret use, the owner can see a last-used date on that key without creating a second key.

## Assumptions

- Display format is a short prefix plus a random secret; the list shows prefix and a masked tail; full plaintext only at create.
- Key length: at least 32 random bytes before encoding.
- Cookie sessions unchanged; do not replace the legacy session module.
- No OAuth, cookies-as-keys, per-key scopes, rate limits, admin UI for other users' keys, or rotation (rotation is a later feature).
- Empty name is invalid; no other name uniqueness rule.
- When both cookie and Bearer are sent, Bearer is decisive (valid key authenticates; invalid key is 401).
- Existing smoke paths remain green.

## Out of Scope

- OAuth, cookies-as-keys, per-key scopes, rate limits, admin UI for other users' keys, rotating a key.
