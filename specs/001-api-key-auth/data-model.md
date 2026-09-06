# Data Model: API key

## Entity: ApiKey

Belongs to one `users` row.

| Field | Meaning | Rules |
|---|---|---|
| id | Stable integer identity | PK, autoincrement |
| user_id | Owning user | NOT NULL, FK users(id) ON DELETE CASCADE |
| name | Display name | Trimmed, non-empty |
| prefix | Public prefix for list/mask | 8 lowercase hex chars, unique among live keys not required |
| token_hash | SHA-256 hex of full plaintext | UNIQUE, NOT NULL |
| created_at | UTC ISO-8601 datetime | NOT NULL |
| last_used_at | UTC ISO-8601 datetime | NULL until first successful Bearer use |
| revoked_at | UTC ISO-8601 datetime | NULL means active |

## Validation

- Name: required after trim; empty → 400, no row, no plaintext.
- Secret: generated server-side; never accepted from the client.
- Authentication lookup: `token_hash = sha256(secret) AND revoked_at IS NULL`.
- List: `user_id = :id AND revoked_at IS NULL ORDER BY created_at DESC, id DESC`.

## State

```
created (plaintext shown once) → active (hash only)
active → revoked (Bearer 401 immediately)
```

Rotation (new secret, same id) is out of scope for this feature.

## Display

- created / last-used UI: `YYYY-MM-DD` from the UTC timestamp.
- Masked secret: `smk_<prefix>_••••<last4>` where last4 is stored only for display (`suffix` column, 4 chars). Do not store the full secret.

Additional field:

| Field | Meaning |
|---|---|
| suffix | Last 4 characters of the plaintext body, for masked tail |

## Relationships

- User 1—* ApiKey
- No relationship to items; Bearer auth loads the user, then existing item queries apply.
