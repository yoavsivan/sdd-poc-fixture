"""Freeze-check: HUMAN.md exception (i) timing and exception (ii) file set."""
from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from run import freeze_check as fc


def git(cwd: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=str(cwd), capture_output=True, text=True, check=check)


def _commit(repo: Path, rel: str, content: str, msg: str) -> str:
    path = repo / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    git(repo, "add", rel)
    git(repo, "commit", "-m", msg)
    return git(repo, "rev-parse", "HEAD").stdout.strip()


class TestFreezeCheck(unittest.TestCase):
    def _bare(self) -> tuple[Path, Path, Path]:
        work = Path(tempfile.mkdtemp())
        remote = Path(tempfile.mkdtemp())
        evidence = Path(tempfile.mkdtemp())
        git(remote, "init", "--bare")
        git(work, "init", "-b", "main")
        git(work, "config", "user.email", "a@b.c")
        git(work, "config", "user.name", "Apricode")
        _commit(work, "harness/pre-registration.json", "{}\n", "pre-trial")
        git(work, "remote", "add", "origin", str(remote))
        git(work, "push", "-u", "origin", "main")
        return work, remote, evidence

    def test_human_md_only_before_any_trial2(self) -> None:
        work, _, evidence = self._bare()
        _commit(work, "harness/HUMAN.md", "# h\n", "HUMAN.md: add")
        git(work, "push", "origin", "main")
        rows = fc.run_check(repo=work, evidence=evidence)
        self.assertEqual(rows[0]["kind"], "i")

    def test_human_md_after_trial1_before_trial2_is_exception_i(self) -> None:
        work, _, evidence = self._bare()
        (evidence / "spawn-log.jsonl").write_text(
            json.dumps({"arm": "conductor", "n": "1", "phase": "after", "at": "2026-09-05T01:00:00Z"}) + "\n",
            encoding="utf-8",
        )
        _commit(work, "harness/HUMAN.md", "# h2\n", "HUMAN.md: after trial 1")
        git(work, "push", "origin", "main")
        rows = fc.run_check(repo=work, evidence=evidence)
        self.assertEqual(rows[0]["kind"], "i")

    def test_human_md_after_trial2_exits_2(self) -> None:
        work, _, evidence = self._bare()
        (evidence / "spawn-log.jsonl").write_text(
            json.dumps({"arm": "conductor", "n": "2", "phase": "after", "at": "2026-09-05T01:00:00Z"}) + "\n",
            encoding="utf-8",
        )
        _commit(work, "harness/HUMAN.md", "# late\n", "HUMAN.md: late")
        git(work, "push", "origin", "main")
        with self.assertRaises(SystemExit) as ctx:
            fc.run_check(repo=work, evidence=evidence)
        self.assertEqual(ctx.exception.code, 2)

    def test_exception_ii_exact_set_and_plus_one(self) -> None:
        work, _, evidence = self._bare()
        files = {
            "harness/features/F1.md": "a\n",
            "harness/features/F1-prime.md": "b\n",
            "harness/score/RUBRIC.md": "c\n",
            "harness/pre-registration-2.json": "{}\n",
        }
        for rel, content in files.items():
            p = work / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding="utf-8")
        git(work, "add", *files)
        git(work, "commit", "-m", "reshape: v2")
        git(work, "push", "origin", "main")
        rows = fc.run_check(repo=work, evidence=evidence)
        self.assertEqual(rows[0]["kind"], "ii")
        _commit(work, "harness/README.md", "nope\n", "reshape plus one")
        git(work, "push", "origin", "main")
        with self.assertRaises(SystemExit):
            fc.run_check(repo=work, evidence=evidence)


if __name__ == "__main__":
    unittest.main()
