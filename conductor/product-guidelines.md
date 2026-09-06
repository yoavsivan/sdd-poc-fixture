# Product guidelines

## Voice and tone

Plain, concise, and practical. Explain what the user needs to do once (for example, that an API secret is shown only at create time). Avoid marketing language.

## UX principles

- Prefer extending the existing Settings page and JSON API over new top-level apps.
- Keep cookie sign-in as the way the browser authenticates.
- Use existing `data-testid` patterns on interactive controls.
- Item lists and key lists are newest first, matching `/items`.
- Timestamps in the UI use the ISO-8601 date `YYYY-MM-DD`; store UTC internally.

## Settings copy (API keys)

Label the section “API keys”. Explain that the secret is shown once and that revoke is immediate.

## Display of secrets

Show the full plaintext once at create. In the list, show a short prefix plus a masked tail. Never persist the plaintext after that first response.
