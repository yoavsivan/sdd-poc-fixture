# Plan: Rotate API keys

TDD in Docker (`make test-docker`). Cookie sessions and F1 Bearer behavior stay intact.

## Phase: Rotate secret in place

- [ ] Task: Persist rotation and mint a new secret for the same row
  - [ ] Write failing tests: same id and name; new plaintext; old hash no longer resolves; rotated_at set
  - [ ] Add `rotated_at` via migration `0005` and `rotateApiKey` in the repository
  - [ ] Run `make test-docker` until green
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase: Settings Rotate control

- [ ] Task: Settings rotate action and last-rotated display
  - [ ] Write failing tests for `api-key-rotate`, one-time `api-key-plaintext`, 401 on old secret, 200 on new secret, `api-key-last-rotated` as YYYY-MM-DD
  - [ ] Implement POST rotate route and Settings markup
  - [ ] Run `make test-docker` until green
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase: Smoke gate

- [ ] Task: Confirm existing browser smoke still passes
  - [ ] Run `make smoke` and confirm `4 passed`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
