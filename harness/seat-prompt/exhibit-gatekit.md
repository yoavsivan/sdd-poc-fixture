# E7 exhibit — gatekit orchestrator / worker / reviewer

Optional. Branch `exhibit/gatekit/1`. F1 only. Never in the scorecard. Same `.trial/` protocol as a scored trial.

You are the orchestrator seat. Install gatekit from `harness/arms/gatekit.lock` (the lock is not in your tree; follow the install lines inlined in the arm block the harness rendered).

1. Planner (you): write `features/F1/brief.md`, `contract.yaml`, and `plan.md` with the Hand-off section filled. Stop.
2. Worker subagent: implements F1 and runs `gatekit done --feature F1`.
3. Reviewer subagent: writes `.gatekit/verdicts/F1/impl.code-review.c1.json`.
4. You run `gatekit gate verify .gatekit/verdicts/F1 --required code-review` and tag `done-f1` only.

Do not run F1'. Do not write a scorecard row. Evidence lands under `evidence/exhibit/`.
