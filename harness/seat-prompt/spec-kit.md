# Spec Kit (GitHub github/spec-kit)

Lifecycle: template-first.

## Install

Pinned commit `{{commit}}` from `{{upstream}}`.

```
{{install}}
```

Commit the generated `.specify/` and `.cursor/skills/` (or `.cursor/commands/` if that is what init wrote) as part of your first commit.

Protocol files (read and follow, in order):

{{protocol_files}}

## F1 sequence

Open and follow, in order: {{stock_sequence_f1}} — `/speckit.constitution` then `/speckit.specify` (with the F1 brief) then `/speckit.clarify` (answer from HUMAN.md) then `/speckit.plan` then `/speckit.tasks` then `/speckit.analyze` then `/speckit.implement`.

## F1' change flow

The upstream docs at this commit (docs/guides/evolving-specs.md, flow-forward spec) prescribe a new numbered feature via `/speckit.specify` for a substantial follow-up, then `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`. Record the choice in `.trial/f1p-flow.md`. Merge any feature branch Spec Kit created into the deliverable branch before tagging.

Stock sequence: {{stock_sequence_f1p}}

## Where your spec lives

{{spec_root}} (+ `.specify/`). Scored files: `specs/<NNN>-<name>/spec.md` and `tasks.md`.
