# Data Model: API key rotation

Extend F1 `api_keys`:

| Field | Meaning |
|---|---|
| rotated_at | UTC ISO-8601 datetime, NULL until first rotate |

Rotate transition:

```
active → active (new token_hash, prefix, suffix; rotated_at set)
```

Id, name, created_at, user_id unchanged. last_used_at unchanged. Old token_hash no longer matches any row.
