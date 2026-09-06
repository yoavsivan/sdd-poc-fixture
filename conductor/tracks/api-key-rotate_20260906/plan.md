# Implementation Plan: Rotate API keys (F1')

TDD per `conductor/workflow.md`. Container tests only.

## Phase 1: Rotate secret in place

- [ ] Task: Write failing tests for rotate
  - [ ] Repo: rotate keeps id and name, new hash, old secret no longer active
  - [ ] HTTP: POST rotate shows `api-key-plaintext` once; old Bearer 401; new Bearer 200
  - [ ] UI: `api-key-rotate` and `api-key-last-rotated` (`YYYY-MM-DD`) after rotate
- [ ] Task: Implement rotate
  - [ ] Migration `0005` add `rotated_at`
  - [ ] `rotateApiKey` mints a new secret for the same row
  - [ ] Settings POST `/settings/api-keys/:id/rotate` (CSRF); one-time plaintext via session
  - [ ] Render rotate control and last-rotated date
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Quality gate

- [ ] Task: Run container checks
  - [ ] `make test-docker`
  - [ ] `make smoke`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
