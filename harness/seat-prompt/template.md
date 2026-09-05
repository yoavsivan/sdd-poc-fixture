# Uniform seat protocol

You are implementing one feature and one follow-up in an existing app you have never seen. Work only inside this repository and the arm's own clone under `/tmp/`. Do not fetch other branches, do not read `main`, do not look for tests that are not in this tree. Acceptance tests exist for this feature; they are not available to you and will be run later against the commits you tag. The feature brief below states what they check.

Your model is {{model}}. Your wall budget is {{wall_minutes}} minutes. Your deliverable branch is {{branch}}.

## Before anything else (logged)

`mkdir -p .trial` · `docker compose version > .trial/env.txt` · `make smoke 2>&1 | tee .trial/smoke-before.txt`. If Docker is unavailable or the smoke is not `4 passed`, write `.trial/ABORT.md` with the exact error, commit, push, and end. Do not run the app or any test with the host Node toolchain; the app and every test run in the fixture's containers (`make smoke`, `make test-docker`).

## Install your arm

{{arm_block}}

Read the arm's protocol files listed there and follow them as your operating instructions. Run only the stock commands in the order listed. If a stock command is a slash-command file, open that file and follow it as the prompt. Do not edit the arm's templates or protocol files. Do not add commands the arm does not ship.

## Human-decision points

Whenever the arm's flow stops for a person — a question, a menu, an approval, a clarification — do not wait. Look up the answer in HUMAN.md (inlined below) by decision type and topic; if no entry applies, apply the defaults rule. Before continuing, append one line to `.trial/decisions.jsonl`:

`{"turn": <your best estimate of the current turn index or null>, "type": "clarify|choose-option|approve-plan|approve-completion|scope|product|other", "question": "<≤200 chars>", "source": "HUMAN.md#<anchor>|default", "answer": "<≤200 chars>"}`.

Then answer the flow as if the person had said that.

## F1

Implement the F1 brief (inlined below) through the arm's stock flow. When the arm's flow says the feature is complete, commit everything (including the arm's spec folder and `.trial/`), then run `git tag done-f1` and record `{"done-f1": "<sha of that commit>"}` in `.trial/tags.json`; commit that file as `trial: record done-f1`.

## F1'

Only now read the F1' brief (inlined below, after the separator). Run the arm's stock change flow as the arm block describes. Write one paragraph to `.trial/f1p-flow.md` naming which stock flow you used for the follow-up and why the arm's docs prescribe it. When complete: commit, `git tag done-f1p`, add `"done-f1p": "<sha>"` to `.trial/tags.json`, commit as `trial: record done-f1p`.

## Deliver

`git push -u origin {{branch}}`. Then, best effort: `git push origin done-f1:refs/tags/{{branch}}/done-f1 done-f1p:refs/tags/{{branch}}/done-f1p`. If tag push fails, say so in `.trial/notes.md` and continue — the harness reads `.trial/tags.json`. If the arm's flow created other branches, merge them into {{branch}} before each tag and push only the deliverable branch.

## Stop conditions

When the harness sends "Time is up", finish the current commit, record whatever tags exist, push, end. Never delete `.trial/`. Never force-push. Never modify `docker-compose.yml`'s `playwright` service, `playwright.config.ts`, the Playwright version, or `test/smoke/` — the existing smoke must stay runnable as is.

## What is off limits

Reading or fetching anything from `main` or from `harness/` (it is not in your tree; do not go looking); any credential other than the one Git already has; any model or API other than the one you are running as; any other trial branch.

## HUMAN.md

{{human_md}}

## features/F1.md

{{f1_brief}}

---- read only after done-f1 ----

## features/F1-prime.md

{{f1p_brief}}

gatekit clone URL placeholder: {{gatekit_url}}
arm={{arm}} n={{n}}
