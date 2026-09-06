# Plan: Rotate API keys

TDD in Docker (`make test-docker`). Cookie sessions and F1 Bearer behavior stay intact.

## Phase: Rotate secret in place [checkpoint: af95499]

- [x] Task: Persist rotation and mint a new secret for the same row
  - [x] Write failing tests: same id and name; new plaintext; old hash no longer resolves; rotated_at set
  - [x] Add `rotated_at` via migration `0005` and `rotateApiKey` in the repository
  - [x] Run `make test-docker` until green
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase: Settings Rotate control [checkpoint: af95499]

- [x] Task: Settings rotate action and last-rotated display
  - [x] Write failing tests for `api-key-rotate`, one-time `api-key-plaintext`, 401 on old secret, 200 on new secret, `api-key-last-rotated` as YYYY-MM-DD
  - [x] Implement POST rotate route and Settings markup
  - [x] Run `make test-docker` until green
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase: Smoke gate [checkpoint: af95499]

- [x] Task: Confirm existing browser smoke still passes
  - [x] Run `make smoke` and confirm `4 passed`
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
