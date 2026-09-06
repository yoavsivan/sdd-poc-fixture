# Product Guidelines

## Voice and tone

- Direct, plain, and slightly bookish — the app is a shelf for links, not a growth product.
- Prefer short sentences that name the thing (`API keys`, `revoke`, `shown once`) over marketing language.
- Error copy is specific and actionable. Do not blame the user.

## Settings and credentials

- Label the keys section **API keys**.
- Explain that the secret is shown once at create and that revoke is immediate.
- Never re-display a full secret after the create (or rotate) response.
- List rows show a short prefix and a masked tail, plus dates as `YYYY-MM-DD`.

## UX principles

- Settings is the home for account, password, and machine credentials — extend that page rather than adding a parallel app.
- Newest-first ordering matches `/items`.
- Cookie sign-in stays the UI path; Bearer tokens are for scripts hitting `/api/*`.
- Destructive actions (revoke) take effect immediately and do not require a second confirmation page unless a track says otherwise.
- Forms keep the existing CSRF hidden field and flash/error patterns.

## Accessibility

- Use the contracted `data-testid` locators from the active track spec so scripted checks and humans share the same controls.
- Buttons and fields need visible labels. Timestamps are text, not title-only tooltips.
