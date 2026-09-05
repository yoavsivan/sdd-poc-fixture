"""Excerpt header format and selectors."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

from run import excerpts as excerpts_mod


class TestExcerpts(unittest.TestCase):
    def setUp(self) -> None:
        self.td = Path(tempfile.mkdtemp())
        self.bl = self.td / "blocklist.txt"
        self.bl.write_text("SYNTH-TOKEN\n", encoding="utf-8")
        os.environ["HARNESS_BLOCKLIST"] = str(self.bl)
        self.tr = json.loads(
            (Path(__file__).parent / "fixtures" / "transcript-sample.json").read_text(encoding="utf-8")
        )

    def tearDown(self) -> None:
        os.environ.pop("HARNESS_BLOCKLIST", None)

    def test_header_format(self) -> None:
        text = excerpts_mod.render_excerpts(self.tr)
        self.assertIn("### turn 1 (assistant)", text)
        self.assertRegex(text, r"### turn \d+ \((user|assistant)\)")

    def test_select_gatekit_done(self) -> None:
        text = excerpts_mod.render_excerpts(self.tr, "gatekit-done")
        self.assertIn("gatekit: REJECT done", text)
        self.assertIn("gatekit: PASS done", text)

    def test_select_decision_most_stops(self) -> None:
        indices = excerpts_mod.select_indices(excerpts_mod.turns_of(self.tr), "decision")
        self.assertTrue(indices)
        self.assertEqual(indices[0], 1)


if __name__ == "__main__":
    unittest.main()
