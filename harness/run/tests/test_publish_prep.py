"""publish-prep: v1-only copy, reshaped v1 under pilot/held-out, verify digest."""
from __future__ import annotations

import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from run.common import EXIT_PRECONDITION, REGISTERED_P_REL, harness_dir, load_config
from run import publish_prep


class TestPublishPrep(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp())
        self.evidence = self.tmp / "evidence"
        self.held = self.tmp / "held"
        self.harness = self.tmp / "harness"
        self.evidence.mkdir()
        self.held.mkdir()
        self.harness.mkdir()
        real = harness_dir()
        for rel in REGISTERED_P_REL:
            dest = self.harness / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes((real / rel).read_bytes())
        acc = self.held / "acceptance"
        acc.mkdir()
        (acc / "f1.spec.ts").write_text("v2-or-v1-body\n", encoding="utf-8")
        spec = self.held / "score" / "specimens"
        spec.mkdir(parents=True)
        (spec / "EXPECTED.json").write_text("{}\n", encoding="utf-8")
        (self.held / "score" / "test_spec_coverage.py").write_text("import unittest\n", encoding="utf-8")
        self.bl = self.tmp / "blocklist.txt"
        self.bl.write_text("SYNTH-TOKEN\n", encoding="utf-8")
        os.environ["HARNESS_BLOCKLIST"] = str(self.bl)
        self.cfg = load_config()
        self._patches = [
            mock.patch.object(publish_prep, "harness_dir", return_value=self.harness),
            mock.patch.object(publish_prep, "run_dir", return_value=self.evidence),
            mock.patch.object(publish_prep, "held_out_dir", return_value=self.held),
        ]
        for p in self._patches:
            p.start()

    def tearDown(self) -> None:
        for p in self._patches:
            p.stop()
        os.environ.pop("HARNESS_BLOCKLIST", None)
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _reg(self, name: str, digest_payload: bytes, registration: int) -> None:
        import hashlib

        files = [
            {
                "path": "harness/acceptance/f1.spec.ts",
                "sha256": hashlib.sha256(digest_payload).hexdigest(),
            },
        ]
        rec = {
            "algorithm": "sha256",
            "count": 1,
            "files": files,
            "registration": registration,
        }
        (self.evidence / name).write_text(json.dumps(rec, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    def test_v1_only_h_at_harness_and_one_registration(self) -> None:
        body = (self.held / "acceptance" / "f1.spec.ts").read_bytes()
        self._reg("pre-registration.json", body, 1)
        publish_prep.publish(self.cfg, verify=False)
        self.assertTrue((self.harness / "acceptance" / "f1.spec.ts").is_file())
        self.assertTrue((self.harness / "pre-registration.json").is_file())
        results = self.harness / self.cfg.get("results_dir", "results/2026-09")
        self.assertTrue((results / "pre-registration.json").is_file())
        self.assertFalse((results / "pre-registration-2.json").is_file())

    def test_reshaped_v1_under_pilot_held_out_and_v2_at_harness_paths(self) -> None:
        body = (self.held / "acceptance" / "f1.spec.ts").read_bytes()
        self._reg("pre-registration.json", b"v1-old-bytes\n", 1)
        self._reg("pre-registration-2.json", body, 2)
        publish_prep.publish(self.cfg, verify=False)
        results = self.harness / self.cfg.get("results_dir", "results/2026-09")
        self.assertTrue((results / "pilot" / "held-out" / "acceptance" / "f1.spec.ts").is_file())
        self.assertTrue((self.harness / "acceptance" / "f1.spec.ts").is_file())
        self.assertTrue((results / "pre-registration.json").is_file())
        self.assertTrue((results / "pre-registration-2.json").is_file())
        self.assertTrue((self.harness / "pre-registration-2.json").is_file())

    def test_verify_fails_on_digest_mismatch(self) -> None:
        self._reg("pre-registration.json", b"other-bytes\n", 1)
        with self.assertRaises(SystemExit) as ctx:
            publish_prep.publish(self.cfg, verify=True)
        self.assertEqual(ctx.exception.code, EXIT_PRECONDITION)

    def test_trial_md_from_whitelist_omits_seat_id(self) -> None:
        body = (self.held / "acceptance" / "f1.spec.ts").read_bytes()
        self._reg("pre-registration.json", body, 1)
        trial_dir = self.evidence / "trials" / "conductor" / "1"
        trial_dir.mkdir(parents=True)
        trial = {
            "adapter": "private",
            "arm": "conductor",
            "branch": "trial/conductor/1",
            "cohort": "v1",
            "credits_reported": 12.5,
            "finished_at": "2026-09-06T03:48:26Z",
            "finished_at_source": "adapter",
            "flags": ["spec-layout-review", "spec-layout-review", "leak-check-false-positive"],
            "invalid_reason": None,
            "messages": None,
            "model": "grok-4.6:high",
            "n": "1",
            "role": "scored",
            "seat_id": "bc-deadbeef-0000-0000-0000-000000000000",
            "spawned_at": "2026-09-06T03:05:20Z",
            "trial": 1,
            "wall_exceeded": False,
            "wall_minutes": 60,
            "wall_minutes_source": "config",
        }
        (trial_dir / "trial.json").write_text(json.dumps(trial) + "\n", encoding="utf-8")
        (trial_dir / "tags.json").write_text(
            json.dumps({"done-f1": "abc", "done-f1p": "def"}) + "\n", encoding="utf-8"
        )
        publish_prep.publish(self.cfg, verify=False)
        results = self.harness / self.cfg.get("results_dir", "results/2026-09")
        md = results / "conductor" / "1" / "trial.md"
        self.assertTrue(md.is_file())
        self.assertFalse((results / "conductor" / "1" / "trial.json").exists())
        text = md.read_text(encoding="utf-8")
        self.assertNotIn("seat_id", text)
        self.assertNotIn("bc-deadbeef", text)
        self.assertIn("| arm | conductor |", text)
        self.assertIn("| credits_reported | reported by dashboard |", text)
        self.assertIn("leak-check-false-positive", text)
        self.assertIn("| sha_done_f1 | abc |", text)
        self.assertNotIn("spec-layout-review, spec-layout-review", text)

    def test_branch_json_copied_to_results_root(self) -> None:
        body = (self.held / "acceptance" / "f1.spec.ts").read_bytes()
        self._reg("pre-registration.json", body, 1)
        (self.evidence / "branch.json").write_text('{"branch":"B","separation":6.2}\n', encoding="utf-8")
        publish_prep.publish(self.cfg, verify=False)
        results = self.harness / self.cfg.get("results_dir", "results/2026-09")
        dest = results / "branch.json"
        self.assertTrue(dest.is_file())
        self.assertEqual(dest.read_text(encoding="utf-8"), '{"branch":"B","separation":6.2}\n')


if __name__ == "__main__":
    unittest.main()
