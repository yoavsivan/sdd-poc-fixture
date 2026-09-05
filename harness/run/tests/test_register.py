"""Registration digest-list tests."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

from run.common import GATEKIT_SHA, PINNED_MODEL, harness_dir, repo_root
from run import register as register_mod


def _ensure_h(held: Path) -> None:
    acc = held / "acceptance"
    acc.mkdir(parents=True, exist_ok=True)
    (acc / "f1.spec.ts").write_text("export {}\n", encoding="utf-8")
    (acc / "f1-prime.spec.ts").write_text("export {}\n", encoding="utf-8")
    (acc / "helpers.ts").write_text("export {}\n", encoding="utf-8")
    (acc / "playwright.config.ts").write_text("export {}\n", encoding="utf-8")
    spec = held / "score" / "specimens"
    spec.mkdir(parents=True, exist_ok=True)
    (spec / "EXPECTED.json").write_text("{}\n", encoding="utf-8")
    (held / "score").mkdir(parents=True, exist_ok=True)
    (held / "score" / "test_spec_coverage.py").write_text("import unittest\n", encoding="utf-8")


class TestRegister(unittest.TestCase):
    def setUp(self) -> None:
        self.held = Path(tempfile.mkdtemp())
        _ensure_h(self.held)
        self.root = repo_root()

    def test_digest_list_covers_h_and_p_sorted(self) -> None:
        entries = register_mod.collect_entries(self.held, self.root)
        paths = [e["path"] for e in entries]
        self.assertEqual(paths, sorted(paths, key=lambda s: s.encode("utf-8")))
        self.assertIn("harness/features/F1.md", paths)
        self.assertIn("harness/features/F1-prime.md", paths)
        self.assertIn("harness/score/RUBRIC.md", paths)
        self.assertTrue(any(p.startswith("harness/acceptance/") for p in paths))
        self.assertTrue(any(p.endswith("test_spec_coverage.py") for p in paths))
        for e in entries:
            self.assertEqual(len(e["sha256"]), 64)

    def test_copies_byte_identical_shape(self) -> None:
        payload = register_mod.build_payload(self.held, self.root, registration=1, supersedes=None)
        a = json.dumps(payload, indent=2, sort_keys=True) + "\n"
        b = json.dumps(json.loads(a), indent=2, sort_keys=True) + "\n"
        self.assertEqual(a, b)

    def test_verify_local_fails_on_one_byte(self) -> None:
        payload = register_mod.build_payload(self.held, self.root, registration=1, supersedes=None)
        dest = Path(tempfile.mkdtemp()) / "pre-registration.json"
        dest.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        register_mod.verify_local(self.held, self.root, dest)
        (self.held / "acceptance" / "f1.spec.ts").write_text("export { changed }\n", encoding="utf-8")
        with self.assertRaises(SystemExit) as ctx:
            register_mod.verify_local(self.held, self.root, dest)
        self.assertEqual(ctx.exception.code, 2)

    def test_v2_carries_supersedes(self) -> None:
        v1 = register_mod.build_payload(self.held, self.root, registration=1, supersedes=None)
        raw = json.dumps(v1, indent=2, sort_keys=True) + "\n"
        digest = register_mod.sha256_bytes(raw.encode("utf-8"))
        v2 = register_mod.build_payload(
            self.held,
            self.root,
            registration=2,
            supersedes={"path": "harness/pre-registration.json", "sha256": digest},
        )
        self.assertEqual(v2["registration"], 2)
        self.assertEqual(v2["supersedes"]["sha256"], digest)
        self.assertIn("reason", v2)

    def test_required_fields(self) -> None:
        payload = register_mod.build_payload(self.held, self.root, registration=1, supersedes=None)
        self.assertEqual(payload["registration"], 1)
        self.assertTrue(str(payload["written_at"]).endswith("Z"))
        self.assertEqual(payload["fixture_tag"]["sha"], "7dc3d08df3e41807b1b575b738e8afb5f7990b93")
        self.assertEqual(payload["gatekit_tag"]["sha"], GATEKIT_SHA)
        self.assertEqual(payload["model"], PINNED_MODEL)


if __name__ == "__main__":
    unittest.main()
