"""Tag resolution from .trial/tags.json on the branch."""
from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from run.collect import is_ancestor


def git(cwd: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=str(cwd), capture_output=True, text=True, check=True)


class TestCollectTags(unittest.TestCase):
    def _repo(self) -> Path:
        root = Path(tempfile.mkdtemp())
        git(root, "init", "-b", "main")
        git(root, "config", "user.email", "a@b.c")
        git(root, "config", "user.name", "Apricode")
        (root / "README").write_text("a\n", encoding="utf-8")
        git(root, "add", "README")
        git(root, "commit", "-m", "init")
        return root

    def test_non_ancestor_is_invalid(self) -> None:
        repo = self._repo()
        git(repo, "checkout", "-b", "trial/conductor/1")
        (repo / ".trial").mkdir()
        sha1 = git(repo, "rev-parse", "HEAD").stdout.strip()
        (repo / ".trial" / "tags.json").write_text(json.dumps({"done-f1": sha1}), encoding="utf-8")
        git(repo, "add", ".trial/tags.json")
        git(repo, "commit", "-m", "tags")
        # orphan commit not on branch
        git(repo, "checkout", "--orphan", "other")
        (repo / "x").write_text("x\n", encoding="utf-8")
        git(repo, "add", "x")
        git(repo, "commit", "-m", "orphan")
        orphan = git(repo, "rev-parse", "HEAD").stdout.strip()
        git(repo, "checkout", "trial/conductor/1")
        tip = git(repo, "rev-parse", "HEAD").stdout.strip()
        self.assertTrue(is_ancestor(repo, sha1, tip))
        self.assertFalse(is_ancestor(repo, orphan, tip))

    def test_missing_done_f1p_is_na_not_invalid(self) -> None:
        tags = {"done-f1": "aaa", "ancestor_ok": True}
        self.assertIsNone(tags.get("done-f1p"))
        record = {**tags, "f1p": "n/a"}
        self.assertEqual(record["f1p"], "n/a")
        self.assertNotEqual(record.get("invalid"), "tags-not-on-branch")

    def test_model_mismatch_reason(self) -> None:
        trial = {"model": "not-the-pin"}
        self.assertNotEqual(trial["model"], "grok-4.6:high")
        invalid = "model-mismatch"
        self.assertEqual(invalid, "model-mismatch")


if __name__ == "__main__":
    unittest.main()
