# gatekit (yoavsivan/gatekit at v0.1.0)

Lifecycle: verification-contract-first.

## Install

Pinned commit `{{commit}}` from `{{upstream}}`.

```
{{install}}
```

Protocol files (read and follow, in order):

{{protocol_files}}

## F1 sequence

{{stock_sequence_f1}}

`gatekit init` → `gatekit feature new F1` → fill `features/F1/brief.md`, `contract.yaml` (machine-runnable checks; `run:` lines must execute inside the fixture's containers, e.g. `make smoke`), `plan.md` (Hand-off section filled), `tasks.md` → implement → `gatekit gate check` on any verdict you write → `gatekit done --feature F1` until it passes. Plan approval and completion approval are decision points: record them (`approve-plan`, `approve-completion`) and answer from HUMAN.md#approvals.

## F1' change flow

Amend `features/F1/brief.md` and `contract.yaml` for rotation, update `tasks.md`, implement, then {{stock_sequence_f1p}} until it passes.

## Where your spec lives

{{spec_root}} (+ `.gatekit/`, `HANDOFF.md`). Scored files: `features/F1/brief.md`, `contract.yaml`.
