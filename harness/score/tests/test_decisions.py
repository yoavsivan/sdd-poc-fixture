"""Decision-point classification and ±1 merge."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from score.decisions import classify_turn, merge, score_transcript


class TestDecisions(unittest.TestCase):
    def test_numbered_menu(self) -> None:
        text = "Pick one:\n1. continue the plan\n2. rewrite the spec\n"
        self.assertEqual(classify_turn(text), "menu")

    def test_approval_phrasing(self) -> None:
        self.assertEqual(classify_turn("Shall I continue with the install?"), "approval")
        self.assertEqual(classify_turn("Looks good — ok to proceed."), "approval")

    def test_question_ending(self) -> None:
        self.assertEqual(classify_turn("Which default should I keep?"), "question")

    def test_merge_within_one_turn_else_derived_only(self) -> None:
        derived = [
            {"excerpt": "menu", "source": "derived-only", "turn": 4, "type": "menu"},
            {"excerpt": "lonely", "source": "derived-only", "turn": 9, "type": "question"},
        ]
        self_rows = [
            {"turn": 5, "type": "menu", "question": "pick", "answer": "1", "source": "HUMAN.md#defaults"},
        ]
        merged = merge(derived, self_rows)
        sources = {m.get("source") for m in merged}
        self.assertIn("HUMAN.md#defaults", sources)
        self.assertIn("derived-only", sources)
        matched = [m for m in merged if m.get("turn") == 5]
        self.assertEqual(len(matched), 1)
        leftover = [m for m in merged if m.get("turn") == 9]
        self.assertEqual(leftover[0]["source"], "derived-only")

    def test_counts_self_and_derived_emitted(self) -> None:
        td = Path(tempfile.mkdtemp())
        transcript = td / "transcript.json"
        transcript.write_text(
            json.dumps(
                {
                    "turns": [
                        {"index": 1, "role": "assistant", "text": "1. yes\n2. no\n"},
                        {"index": 2, "role": "assistant", "text": "Shall I continue?"},
                    ]
                }
            )
            + "\n",
            encoding="utf-8",
        )
        self_path = td / "decisions.jsonl"
        self_path.write_text(
            json.dumps({"turn": 1, "type": "menu", "question": "pick", "answer": "1"}) + "\n",
            encoding="utf-8",
        )
        out = score_transcript(transcript, self_path)
        self.assertEqual(out["counts_derived"], 2)
        self.assertEqual(out["counts_self"], 1)
        self.assertIn("counts_self", out)
        self.assertIn("counts_derived", out)


if __name__ == "__main__":
    unittest.main()
