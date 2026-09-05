# Conductor (Google's gemini-cli-extensions/conductor)

Conductor here is Google's `gemini-cli-extensions/conductor` (Apache-2.0; plugin for Antigravity, Claude Code and Gemini CLI), not Melty Labs' Conductor (conductor.build). Lifecycle: context-first.

## Install

Pinned commit `{{commit}}` from `{{upstream}}`.

```
{{install}}
```

Protocol files (read and follow, in order):

{{protocol_files}}

## F1 sequence

{{stock_sequence_f1}}

Brownfield: `conductor-setup` interviews you about product, tech stack, workflow — answer from HUMAN.md#project-context. Then `conductor-new-track` with the F1 brief as the track request, then `conductor-implement`, then `conductor-review`.

## F1' change flow

A new track — {{stock_sequence_f1p}} — with the F1' brief (stock behavior for a follow-up).

## Where your spec lives

{{spec_root}} — `conductor/product.md`, `conductor/tech-stack.md`, `conductor/workflow.md`, `conductor/tracks/<id>/spec.md`, `conductor/tracks/<id>/plan.md` (the last two are what is scored).
