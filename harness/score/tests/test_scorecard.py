"""Scorecard columns, means, null drop, pilots, invalids, budget skip."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from score.scorecard import COLUMNS, coverage_drop, mean_drop_null, write_invalid, write_table


def _trial(
    root: Path,
    arm: str,
    n: str,
    *,
    role: str = "scored",
    coverage_f1: str = "80",
    coverage_f1p: str = "70",
    invalid_reason: str = "",
    spawned_at: str = "2026-09-05T01:00:00Z",
    finished_at: str = "2026-09-05T01:40:00Z",
) -> Path:
    dest = root / "trials" / arm / n
    dest.mkdir(parents=True, exist_ok=True)
    trial = {
        "arm": arm,
        "trial": int(n) if n.isdigit() else n,
        "cohort": "v1",
        "role": role,
        "model": "grok-4.6:high",
        "spawned_at": spawned_at,
        "finished_at": finished_at,
        "invalid_reason": invalid_reason or None,
        "flags": [],
        "tie_break_trigger": "none",
    }
    (dest / "trial.json").write_text(json.dumps(trial, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (dest / "coverage-f1.json").write_text(json.dumps({"pct": float(coverage_f1) if coverage_f1 != "" else None, "total": 1}) + "\n")
    f1p = None if coverage_f1p == "" else float(coverage_f1p)
    (dest / "coverage-f1p.json").write_text(json.dumps({"pct": f1p, "total": 0 if f1p is None else 1}) + "\n")
    return dest


class TestScorecard(unittest.TestCase):
    def setUp(self) -> None:
        self.td = Path(tempfile.mkdtemp())

    def test_header_equals_columns_and_rows_alphabetical(self) -> None:
        _trial(self.td, "spec-kit", "1", coverage_f1p="60")
        _trial(self.td, "conductor", "1", coverage_f1p="80")
        _trial(self.td, "gatekit", "1", coverage_f1p="70")
        dest = write_table(self.td, self.td / "trials")
        lines = dest.read_text(encoding="utf-8").splitlines()
        self.assertEqual(lines[0].split(","), COLUMNS)
        arms = [ln.split(",")[0] for ln in lines[1:] if ln and not ln.startswith("#")]
        self.assertEqual(arms[:3], ["conductor", "gatekit", "spec-kit"])

    def test_means_use_scored_and_tiebreak_only(self) -> None:
        _trial(self.td, "conductor", "1", role="scored", coverage_f1p="80")
        _trial(self.td, "conductor", "2", role="tie-break", coverage_f1p="60")
        _trial(self.td, "conductor", "9", role="pilot", coverage_f1p="10")
        rows = []
        write_table(self.td, self.td / "out")
        csv = (self.td / "out" / "scorecard.csv").read_text(encoding="utf-8")
        self.assertIn("tie-break", csv)
        mean = mean_drop_null(["80", "60", "10"])
        scored_only = mean_drop_null(["80", "60"])
        self.assertEqual(scored_only, 70.0)
        self.assertNotEqual(mean, scored_only)

    def test_mean_drops_null_not_zero(self) -> None:
        self.assertEqual(mean_drop_null(["80", "", None, "60"]), 70.0)
        self.assertIsNone(mean_drop_null(["", None]))
        self.assertEqual(coverage_drop("90", ""), "")
        self.assertEqual(coverage_drop("90", "40"), 50.0)

    def test_pilot_rows_in_separate_block(self) -> None:
        _trial(self.td, "conductor", "1", role="scored")
        _trial(self.td, "gatekit", "1", role="pilot")
        dest = write_table(self.td, self.td / "trials")
        text = dest.read_text(encoding="utf-8")
        self.assertIn("# pilot (reshaped brief; never in a mean)", text)
        self.assertGreater(text.index("# pilot"), text.index("conductor"))

    def test_invalid_rows_only_in_invalid_md(self) -> None:
        _trial(self.td, "conductor", "1", role="scored")
        _trial(self.td, "gatekit", "1", role="invalid", invalid_reason="model-mismatch")
        table = write_table(self.td, self.td / "trials")
        csv = table.read_text(encoding="utf-8")
        self.assertNotIn("model-mismatch", csv)
        inv = write_invalid(self.td, self.td / "trials")
        self.assertIn("model-mismatch", inv.read_text(encoding="utf-8"))
        self.assertIn("gatekit", inv.read_text(encoding="utf-8"))

    def test_timestamps_and_budget_skipped_row(self) -> None:
        _trial(self.td, "conductor", "1")
        _trial(self.td, "gatekit", "1")
        _trial(self.td, "spec-kit", "1")
        (self.td / "tiebreak-decisions.json").write_text(
            json.dumps({"conductor": {"run": False, "reason": "budget", "trigger": "spread"}}) + "\n",
            encoding="utf-8",
        )
        dest = write_table(self.td, self.td / "trials")
        text = dest.read_text(encoding="utf-8")
        self.assertIn("2026-09-05T01:00:00Z", text)
        self.assertIn("2026-09-05T01:40:00Z", text)
        self.assertIn("tie-break not run: budget", text)
        self.assertIn(",3,", text)
        self.assertIn("spread", text)


if __name__ == "__main__":
    unittest.main()
