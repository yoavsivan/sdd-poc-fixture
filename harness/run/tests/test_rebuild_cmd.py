"""Rebuild compose command string: worktree, project, overlay, down -v, mount."""
from __future__ import annotations

import unittest
from pathlib import Path

from run import rebuild


class TestRebuildCmd(unittest.TestCase):
    def test_composed_string_has_worktree_project_overlay_down(self) -> None:
        worktree = Path("/tmp/wt")
        held = Path("/tmp/held-out-root")
        cmd = rebuild.composed_command_string(
            "conductor",
            1,
            "done-f1",
            worktree,
            held,
            "abc1234",
        )
        self.assertIn("git worktree add", cmd)
        self.assertIn("harness-conductor-1-done-f1", cmd)
        self.assertIn("compose.acceptance.yml", cmd)
        self.assertIn("down -v", cmd)
        self.assertTrue(cmd.rstrip().endswith("down -v") or "down -v" in cmd)

    def test_mount_is_held_out_acceptance_read_only(self) -> None:
        compose = Path(__file__).resolve().parents[1] / "compose.acceptance.yml"
        text = compose.read_text(encoding="utf-8")
        self.assertIn("${HARNESS_HELD_OUT}/acceptance:/work/.heldout/acceptance:ro", text)
        held = Path("/tmp/held-out-root")
        cmd = rebuild.composed_command_string(
            "gatekit",
            2,
            "done-f1p",
            Path("/tmp/wt"),
            held,
            "deadbeef",
        )
        self.assertIn("/work/.heldout/acceptance:ro", cmd)
        self.assertIn(str(held / "acceptance"), cmd)


if __name__ == "__main__":
    unittest.main()
