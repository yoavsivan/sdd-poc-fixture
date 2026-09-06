# Research: Rotate API keys

## Decision: In-place secret replacement

- **Choice**: `UPDATE` the same `api_keys` row: new `secret_hash`, `prefix`, `secret_tail`, `last_rotated_at`. Do not insert a second row. Old hash is gone so lookup fails immediately.
- **Rationale**: Brief requires same id and name, no concurrent secrets.
- **Rejected**: Dual-secret overlap window; new row with same name.
