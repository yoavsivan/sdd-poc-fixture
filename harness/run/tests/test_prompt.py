"""Prompt tests: identical protocol, canary against held-out, config wall/model."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from run.common import load_config
from run import prompt as prompt_mod


class TestPrompt(unittest.TestCase):
    def setUp(self) -> None:
        self.cfg = load_config()
        self.held = Path(tempfile.mkdtemp())
        (self.held / "acceptance").mkdir()
        (self.held / "acceptance" / "canary.txt").write_text("CANARY-HELD-OUT-TOKEN-9f3a\n", encoding="utf-8")

    def test_contains_briefs_and_no_placeholders(self) -> None:
        text = prompt_mod.render_prompt("gatekit", 1, self.cfg, held=self.held)
        self.assertIn("create a named API key", text)
        self.assertIn("Rotate keeps id and name", text)
        self.assertIn("## project-context", text)
        self.assertIn("gatekit init", text)
        self.assertNotIn("{{", text)
        self.assertIn("---- read only after done-f1 ----", text)
        f1_at = text.index("create a named API key")
        sep_at = text.index("---- read only after done-f1 ----")
        self.assertLess(f1_at, sep_at)

    def test_arms_differ_only_in_block_and_fields(self) -> None:
        a = prompt_mod.render_prompt("conductor", 1, self.cfg, held=self.held)
        b = prompt_mod.render_prompt("gatekit", 1, self.cfg, held=self.held)
        c = prompt_mod.render_prompt("spec-kit", 1, self.cfg, held=self.held)
        self.assertIn("conductor-setup", a)
        self.assertIn("gatekit init", b)
        self.assertIn("/speckit.specify", c)
        self.assertIn("trial/conductor/1", a)
        self.assertIn("trial/gatekit/1", b)

    def test_held_out_canary_absent(self) -> None:
        text = prompt_mod.render_prompt("conductor", 1, self.cfg, held=self.held)
        self.assertNotIn("CANARY-HELD-OUT-TOKEN-9f3a", text)

    def test_wall_and_model_from_config(self) -> None:
        text = prompt_mod.render_prompt("spec-kit", 2, self.cfg, wall_minutes=90, held=self.held)
        self.assertIn("90", text)
        self.assertIn("grok-4.6:high", text)


if __name__ == "__main__":
    unittest.main()
