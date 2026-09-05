"""Schedule tests: interleaved order, tie-break fire order, ARMS membership."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from run.common import load_config
from run import schedule


class TestSchedule(unittest.TestCase):
    def setUp(self) -> None:
        self.cfg = load_config()

    def test_n1_order(self) -> None:
        self.assertEqual(schedule.order_for_n(1, self.cfg), ["conductor", "gatekit", "spec-kit"])

    def test_n2_order(self) -> None:
        self.assertEqual(schedule.order_for_n(2, self.cfg), ["gatekit", "spec-kit", "conductor"])

    def test_tiebreak_follows_timestamps(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "tiebreak-triggers.jsonl"
            rows = [
                {"arm": "spec-kit", "fired_at": "2026-09-05T10:00:00Z", "trigger": "spread"},
                {"arm": "conductor", "fired_at": "2026-09-05T09:00:00Z", "trigger": "passfail"},
                {"arm": "gatekit", "fired_at": "2026-09-05T09:00:00Z", "trigger": "both"},
            ]
            p.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")
            self.assertEqual(schedule.tiebreak_order(p), ["conductor", "gatekit", "spec-kit"])

    def test_unknown_arm_and_no_fourth(self) -> None:
        with self.assertRaises(SystemExit):
            schedule.require_arm("openspec")
        capped = schedule.cap_tiebreak(["conductor", "conductor", "gatekit"])
        self.assertEqual(capped, ["conductor", "gatekit"])
        self.assertLessEqual(len(capped), 3)


if __name__ == "__main__":
    unittest.main()
