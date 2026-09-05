"""stale.json schema: six questions, count equals contradicted statements."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from score.stale.collect import collect, validate


def _six(extra_missing: bool = False) -> dict:
    questions = [{"q": i, "contradicted": []} for i in range(1, 7)]
    questions[0]["contradicted"] = [{"statement": "old claim", "where": "spec", "code_ref": "a"}]
    questions[3]["contradicted"] = [
        {"statement": "wrong 401", "where": "spec", "code_ref": "b"},
        {"statement": "cookie-only", "where": "spec", "code_ref": "c"},
    ]
    data = {"questions": questions if not extra_missing else questions[:-1], "count": 3}
    return data


class TestStaleCollect(unittest.TestCase):
    def test_six_questions_count_equals_contradicted(self) -> None:
        data = _six()
        self.assertEqual(validate(data), 3)
        trial = Path(tempfile.mkdtemp())
        (trial / "stale.json").write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        self.assertEqual(collect(trial), 3)
        self.assertEqual((trial / "stale-count.txt").read_text(encoding="utf-8").strip(), "3")

    def test_missing_question_errors(self) -> None:
        data = _six(extra_missing=True)
        with self.assertRaises(SystemExit):
            validate(data)


if __name__ == "__main__":
    unittest.main()
