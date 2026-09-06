# Hand-off protocol (gatekit)

## Three roles, three sessions

Planner · Executor · Reviewer — what each reads, writes, and where it stops. The planner never
implements; the executor never writes its own verdict; the reviewer never edits code.

## Where things live

features/<id>/{brief.md, contract.yaml, plan.md, tasks.md, DONE.json} ·
.gatekit/gate-kinds.json · .gatekit/verdicts/<feature>/<unit>.<kind>.c<cycle>.json ·
.gatekit/evidence/<feature>/<check>.log

## What "done" means here

`gatekit done --feature <id>` exit 0: every contract check passed and every required gate has a
PASS verdict at its latest cycle. Exit 2 names the first failure. Nobody declares done in prose.

## The two moments a person (or a controller) decides

1. Approving the plan — before the executor starts (a `plan-review` verdict, or a human reading plan.md).
2. Accepting done — after `gatekit done` passes and the reviewer's verdict is in.

## Exit codes

0 pass · 2 reject-or-fail · 1 usage · 3 environment. Branch on them.
