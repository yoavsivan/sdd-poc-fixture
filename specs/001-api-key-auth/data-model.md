# Data Model: API keys

## api_keys

| Column | Type | Notes |
|--------|------|--------|
| id | INTEGER PK | Stable row id |
| user_id | INTEGER NOT NULL | FK users(id) ON DELETE CASCADE |
| name | TEXT NOT NULL | Trimmed display name |
| prefix | TEXT NOT NULL | First 8 chars of plaintext for list display |
| secret_tail | TEXT NOT NULL | Last 4 chars of plaintext for masked list display |
| secret_hash | TEXT NOT NULL UNIQUE | SHA-256 hex of full plaintext |
| created_at | TEXT NOT NULL | UTC ISO-8601 datetime |
| last_used_at | TEXT NULL | UTC ISO-8601; null until first successful Bearer auth |
| revoked_at | TEXT NULL | UTC ISO-8601; null means active |

Indexes: `user_id`; unique `secret_hash`.

Ordering: `created_at DESC, id DESC` (newest first).

## Lifecycle

1. Create → active, `last_used_at` null, plaintext returned once to UI.
2. Bearer success → `last_used_at` updated.
3. Revoke → `revoked_at` set; hash remains so the old secret never matches an active row.

## UI date format

Store full UTC ISO strings. Render `YYYY-MM-DD` via the first 10 characters.
