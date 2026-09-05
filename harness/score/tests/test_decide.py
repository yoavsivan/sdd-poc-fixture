"""Headline branch, bands, overlays, null-arm exclusion, budget."""
from __future__ import annotations

import unittest
from pathlib import Path

from score.decide import (
    budget,
    compute_branch,
    indistinguishable,
    partition,
    thresholds,
    tiebreak_triggers,
)
from score.scorecard import coverage_drop


def _thr() -> dict:
    return thresholds(Path("score/RUBRIC.md"))


def _row(arm: str, cov, *, n: int = 1, role: str = "scored", f1="pass", f1p="pass", decisions="2", files="3"):
    return {
        "arm": arm,
        "trial": str(n),
        "role": role,
        "coverage_f1p": "" if cov is None else str(cov),
        "f1_acceptance": f1,
        "f1p_acceptance": f1p,
        "decisions_derived": decisions,
        "files_touched_f1p": files,
    }


class TestDecide(unittest.TestCase):
    def test_separation_bands(self) -> None:
        thr = _thr()
        self.assertEqual(partition(9.9, thr), "B")
        self.assertEqual(partition(10.0, thr), "A-")
        self.assertEqual(partition(19.9, thr), "A-")
        self.assertEqual(partition(20.0, thr), "A")

    def test_spread_trigger_threshold(self) -> None:
        thr = _thr()
        rows = [
            _row("conductor", 80, n=1),
            _row("conductor", 65, n=2),  # spread 15.0
            _row("gatekit", 70, n=1),
            _row("gatekit", 70, n=2),
            _row("spec-kit", 70, n=1),
            _row("spec-kit", 70, n=2),
        ]
        trig = tiebreak_triggers(rows, thr)
        self.assertFalse(any(t["arm"] == "conductor" for t in trig))
        rows[1]["coverage_f1p"] = "64.9"  # spread 15.1
        trig = tiebreak_triggers(rows, thr)
        hit = [t for t in trig if t["arm"] == "conductor"]
        self.assertEqual(hit[0]["trigger"], "spread")

    def test_passfail_and_both_still_one_seat(self) -> None:
        thr = _thr()
        rows = [
            _row("conductor", 80, n=1, f1="pass", f1p="pass"),
            _row("conductor", 80, n=2, f1="fail", f1p="pass"),
            _row("gatekit", 50, n=1),
            _row("spec-kit", 50, n=1),
        ]
        trig = tiebreak_triggers(rows, thr)
        self.assertEqual(trig[0]["trigger"], "passfail")
        rows[1]["coverage_f1p"] = "50"  # spread 30 plus disagreement
        trig = tiebreak_triggers(rows, thr)
        self.assertEqual(trig[0]["trigger"], "both")
        self.assertEqual(len([t for t in trig if t["arm"] == "conductor"]), 1)

    def test_a_minus_variant_i_vs_ii(self) -> None:
        thr = _thr()
        # sep 15, spreads 0 → variant ii
        rows = [
            _row("conductor", 80),
            _row("gatekit", 65),
            _row("spec-kit", 65),
        ]
        out = compute_branch(rows, thr)
        self.assertEqual(out["branch"], "A-")
        self.assertEqual(out["a_minus_variant"], "ii")
        rows = [
            _row("conductor", 90, n=1),
            _row("conductor", 70, n=2),  # mean 80, spread 20
            _row("gatekit", 65),
            _row("spec-kit", 65),
        ]
        out = compute_branch(rows, thr)
        self.assertEqual(out["branch"], "A-")
        self.assertEqual(out["a_minus_variant"], "i")

    def test_budget_skipped_tiebreak_widens_spread(self) -> None:
        thr = _thr()
        rows = [
            _row("conductor", 80),
            _row("gatekit", 68),
            _row("spec-kit", 68),
        ]
        out = compute_branch(rows, thr)
        self.assertEqual(out["a_minus_variant"], "ii")
        out2 = compute_branch(rows, thr, budget_skipped={"conductor": {"run": False, "reason": "budget"}})
        self.assertEqual(out2["branch"], "A-")
        self.assertGreaterEqual(out2["largest_spread"], 15)
        self.assertEqual(out2["a_minus_variant"], "i")

    def test_one_null_arm_excluded_separation_over_remaining(self) -> None:
        thr = _thr()
        rows = [
            _row("conductor", None, n=1),
            _row("conductor", None, n=2),
            _row("gatekit", 80),
            _row("spec-kit", 50),
        ]
        out = compute_branch(rows, thr)
        self.assertEqual(out["excluded_arms"], ["conductor"])
        self.assertEqual(out["separation"], 30.0)
        self.assertEqual(out["branch"], "A")
        self.assertIn("C", out["overlays"])
        self.assertTrue(any("conductor" in n for n in out["notes"]))

    def test_fewer_than_two_figured_arms_is_b_overlay_c(self) -> None:
        thr = _thr()
        rows = [
            _row("conductor", None),
            _row("gatekit", None),
            _row("spec-kit", 40),
        ]
        out = compute_branch(rows, thr)
        self.assertEqual(out["separation"], 0)
        self.assertEqual(out["branch"], "B")
        self.assertIn("C", out["overlays"])
        self.assertEqual(sorted(out["excluded_arms"]), ["conductor", "gatekit"])

    def test_coverage_drop_null_when_either_side_null(self) -> None:
        self.assertEqual(coverage_drop("90", None), "")
        self.assertEqual(coverage_drop("", "40"), "")
        self.assertEqual(coverage_drop("90", "40"), 50.0)

    def test_indistinguishable_requires_four_conditions(self) -> None:
        thr = _thr()
        rows = [
            _row("conductor", 72, decisions="3", files="4"),
            _row("gatekit", 71, decisions="3", files="4"),
            _row("spec-kit", 70, decisions="2", files="4"),
        ]
        out = indistinguishable(rows, thr)
        self.assertTrue(out["verdict"])
        rows[2]["files_touched_f1p"] = "9"
        self.assertFalse(indistinguishable(rows, thr)["verdict"])

    def test_overlays_independent_and_budget_park(self) -> None:
        thr = _thr()
        rows = [
            _row("conductor", 90),
            _row("gatekit", 40, f1="fail"),
            _row("spec-kit", 85),
        ]
        out = compute_branch(rows, thr)
        self.assertEqual(out["branch"], "A")
        self.assertIn("D", out["overlays"])
        rows2 = [
            _row("conductor", 80, n=1),
            _row("conductor", 50, n=2),
            _row("gatekit", 70),
            _row("spec-kit", 70),
        ]
        out2 = compute_branch(rows2, thr)
        self.assertIn("E", out2["overlays"])
        spend = Path("/tmp/spend-harness-test.json")
        spend.write_text('{"projected_total": 600}\n', encoding="utf-8")
        self.assertEqual(budget(spend), "go")
        spend.write_text('{"projected_total": 601}\n', encoding="utf-8")
        self.assertEqual(budget(spend), "park")


if __name__ == "__main__":
    unittest.main()
