# RUBRIC — metrics, globs, synonyms, thresholds

Frozen for the trial window (rewrite only in the one reshape commit). `spec_coverage.py` and `decide.py` read configuration **only** from the fenced `json rubric:*` blocks below.

## Seven metrics

1. **Acceptance F1 / F1'** — pass/fail of the held-out Playwright specs at `done-f1` and `done-f1p`.
2. **Regression** — the fixture's 4-test smoke at the same tags.
3. **Spec coverage of shipped surface (primary).** Extract routes and UI controls from the diff against `fixture-v1`; match them against the arm's glob-matched spec files at the tag. Headline = mean coverage at `done-f1p`.
4. **Stale statements** — unblinded review against the six questions in §stale.
5. **Human-decision points** — self-reported and transcript-derived counts, both reported.
6. **Cost proxy** — seat minutes and messages; credits only in `trial.md` if the dashboard exposes them.
7. **Review burden** — spec + diff lines at `done-f1p`.

## Derivation (primary metric)

Extraction reads added lines of `git diff --unified=0 --no-color <base> <tag>` with `rubric:excludes` applied. Routes from Express-style registrations in `*.ts *.js *.cjs *.mjs`; UI controls from `data-testid`, `aria-label`, and single-line button/label text in `*.ejs *.html`. Matching is case-insensitive against the concatenated glob files: literal id, word form, `:param`/`{param}`/`<param>` for routes, then — only if the id is a `rubric:synonyms` key — listed phrases and generated singular/plural and hyphen/space variants. Files under the spec root that the glob misses are listed as unmatched candidates and set `spec_layout_review`; they are not read for matching.

`pct = round(100 * matched / total, 1)` when `total > 0`. `total == 0` at a tag that exists → `pct` null and flag `no-surface`. Missing `done-f1p` → `coverage_f1p` null with flag `missing-done-f1p`.

## Synonym procedure

The list is derived only from `features/F1.md` and `features/F1-prime.md`. Variants are generated at match time, never listed by hand.

```json rubric:globs
{
  "conductor": ["conductor/tracks/*/spec.md", "conductor/tracks/*/plan.md"],
  "gatekit": ["features/*/brief.md", "features/*/contract.yaml"],
  "spec-kit": ["specs/*/spec.md", "specs/*/tasks.md"]
}
```

```json rubric:mounts
{
  "src/http/routes/api.ts": "/api"
}
```

```json rubric:excludes
[".trial/", "conductor/", "specs/", ".specify/", "features/", ".gatekit/", ".cursor/", "HANDOFF.md"]
```

```json rubric:synonyms
{
  "api-key-create": ["create a named API key", "named API key"],
  "api-key-plaintext": ["plaintext shown once", "shown once"],
  "api-key-last-rotated": ["last rotated"],
  "api-key-rotate": ["Rotate", "new secret for the same key"],
  "header:authorization-bearer": ["Authorization: Bearer", "Bearer token", "API key authenticates"]
}
```

```json rubric:thresholds
{
  "coverage_drop_null_when_either_side_null": true,
  "exclude_arm_from_separation_when_all_null": true,
  "null_coverage_f1p": "drop_from_mean",
  "separation_bands": {"A_minus_upper": 20, "B_upper": 10},
  "separation_when_fewer_than_two_arms": 0,
  "separation_zero_branch": "B",
  "spread_not_computed_flag": "spread not computed: missing f1p",
  "spread_only_non_null_pairs": true,
  "spread_trigger": 15
}
```

Bands: B `separation < 10`; A− `[10, 20)`; A `≥ 20`. Within-arm spread trigger: `> 15` on non-null `coverage_f1p` pairs.

## §stale (six questions)

1. Does the spec still claim a behaviour the code no longer implements?
2. Does the spec omit a control or route the diff added for F1'?
3. Does the spec name a `data-testid` the views do not ship?
4. Does the spec require a 401 body other than `{"error":"unauthorized"}`?
5. Does the spec still describe cookie-only API auth after keys shipped?
6. Does the spec contradict the rotate-keeps-id rule?

Each answer is `{q, contradicted:[{statement, where, code_ref}]}`. Count = number of contradicted statements.
