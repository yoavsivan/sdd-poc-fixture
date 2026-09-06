# Implementation Plan: Rotate API keys (F1')

TDD per `conductor/workflow.md`. Container tests only.

## Phase 1: Rotate secret in place [checkpoint: 48a1ab8]

- [x] Task: Write failing tests for rotate
  - [x] Repo: rotate keeps id and name, new hash, old secret no longer active
  - [x] HTTP: POST rotate shows `api-key-plaintext` once; old Bearer 401; new Bearer 200
  - [x] UI: `api-key-rotate` and `api-key-last-rotated` (`YYYY-MM-DD`) after rotate
- [x] Task: Implement rotate
  - [x] Migration `0005` add `rotated_at`
  - [x] `rotateApiKey` mints a new secret for the same row
  - [x] Settings POST `/settings/api-keys/:id/rotate` (CSRF); one-time plaintext via session
  - [x] Render rotate control and last-rotated date
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Quality gate [checkpoint: 48a1ab8]

- [x] Task: Run container checks
  - [x] `make test-docker` (56 passed)
  - [x] `make smoke` (4 passed)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
