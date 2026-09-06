# Product Guidelines

## Voice and tone

- Calm, practical, and specific. Explain what the user can do, not the architecture.
- Prefer short sentences. Avoid marketing language.
- Error copy is factual (`Current password is not correct`) rather than witty.

## Settings copy

- Label the API-key section **API keys**.
- Explain that the secret is shown once at create time and that revoke is immediate.
- Keep the existing account and password panels; extend the page rather than replacing it.

## Visual language

- Stay inside the existing Shelfmark look: serif headings, warm paper background, rounded panels, accent green, danger red for destructive actions.
- Use existing components: `panel`, `btn`, `btn-primary`, `btn-danger`, `btn-quiet`, `muted`, `kv`.
- Touch targets should remain usable on a narrow viewport (`@media (max-width: 640px)` already stacks page heads).

## UX principles

- Show a secret only once. After reload, list a prefix and a masked tail, never the full plaintext.
- Destructive actions (revoke) take effect immediately with no grace period.
- Timestamps in the UI: ISO-8601 date (`YYYY-MM-DD`) for created and last-used.
- Preserve `data-testid` locators required by acceptance tests; do not rename them after they ship.

## Accessibility

- Keep visible labels on form fields.
- Keep focus outlines already defined in `src/public/styles.css`.
- Pair buttons with clear verbs: Create, Revoke, Update password.
