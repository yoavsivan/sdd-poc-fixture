# {{feature}} — plan

## Approach

How the brief will be met, in the codebase as it is. Name the files that change.

## Steps

Ordered. Each step should become a task in tasks.md.

1. …

## Risks and decisions

Decisions the planner made so the executor does not have to; questions that would stop an
unattended executor, answered here.

## Hand-off

The session that planned is not the session that executes. Fill every row.

| Field | Value |
|---|---|
| **Planner** | who or which session wrote brief.md, contract.yaml and this plan — and stops here |
| **Executor** | who or which session implements; starts by reading brief.md, this file and contract.yaml |
| **Reviewer** | who writes `.gatekit/verdicts/{{feature}}/<unit>.<kind>.c<n>.json`; not the executor |
| **Budget** | wall time / messages / cost the executor may spend before stopping |
| **Stop condition** | `gatekit done --feature {{feature}}` exits 0; or the budget is spent; or a check cannot be met without changing brief.md — then stop and report, do not edit the contract |
| **Inputs** | files the executor must read first |
| **Outputs** | the diff, tasks.md with evidence, DONE.json |
