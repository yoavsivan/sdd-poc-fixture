"""Reshape bookkeeping: v2 required, pilot move, ref-rename plan."""
from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path

from run.common import EXIT_PRECONDITION
from run import reshape as reshape_mod


class TestReshape(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp())
        self.evidence = self.tmp / "evidence"
        self.evidence.mkdir()

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_refuses_without_pre_registration_2(self) -> None:
        with self.assertRaises(SystemExit) as ctx:
            reshape_mod.reshape(self.evidence)
        self.assertEqual(ctx.exception.code, EXIT_PRECONDITION)

    def test_moves_trials_1_to_pilot(self) -> None:
        (self.evidence / "pre-registration-2.json").write_text("{}\n", encoding="utf-8")
        src = self.evidence / "trials" / "conductor" / "1"
        src.mkdir(parents=True)
        (src / "trial.json").write_text('{"arm": "conductor", "trial": 1, "role": "scored"}\n', encoding="utf-8")
        (src / "note.txt").write_text("keep\n", encoding="utf-8")
        reshape_mod.reshape(self.evidence)
        dest = self.evidence / "trials" / "pilot" / "conductor" / "1"
        self.assertTrue((dest / "note.txt").is_file())
        self.assertFalse(src.exists())
        self.assertEqual(
            (dest / "trial.json").read_text(encoding="utf-8"),
            '{\n  "arm": "conductor",\n  "role": "pilot",\n  "trial": 1\n}\n',
        )

    def test_ref_rename_plan_trial_to_pilot(self) -> None:
        plan = reshape_mod.ref_rename_plan()
        pairs = {(row["from_branch"], row["to_branch"]) for row in plan}
        self.assertIn(("trial/conductor/1", "pilot/conductor/1"), pairs)
        self.assertIn(("trial/spec-kit/1", "pilot/spec-kit/1"), pairs)
        self.assertIn(("trial/gatekit/1", "pilot/gatekit/1"), pairs)


if __name__ == "__main__":
    unittest.main()
