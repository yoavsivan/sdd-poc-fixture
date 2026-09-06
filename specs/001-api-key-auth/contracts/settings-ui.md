# UI contract: Settings API keys

Locators the acceptance tests will use:

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

Copy:

- Section heading: “API keys”
- Explain that the secret is shown once and that revoke is immediate.

Behavior:

- Create shows `api-key-plaintext` with a non-empty secret.
- Reload omits `api-key-plaintext`.
- Each row shows name and created `YYYY-MM-DD`.
- After use, last used `YYYY-MM-DD` appears in `api-key-last-used`.
- Revoke control immediately retires that secret.
- Rows newest first.
