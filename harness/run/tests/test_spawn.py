"""Spawn preconditions (1)–(3), (5), (6), (7), (8), (9) and a fake adapter."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

from run.common import EXIT_PRECONDITION, H_REL_PATHS, PINNED_MODEL, REGISTERED_P_REL, harness_dir
from run import register as register_mod
from run import spawn as spawn_mod


def git(cwd: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=str(cwd), capture_output=True, text=True, check=check)


class TestSpawn(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp())
        self.repo = self.tmp / "repo"
        self.evidence = self.tmp / "evidence"
        self.held = self.tmp / "held"
        self.repo.mkdir()
        self.evidence.mkdir()
        (self.evidence / "preflight").mkdir()
        self.held.mkdir()
        git(self.repo, "init", "-b", "main")
        git(self.repo, "config", "user.email", "a@b.c")
        git(self.repo, "config", "user.name", "Apricode")
        (self.repo / "README.md").write_text("fixture\n", encoding="utf-8")
        git(self.repo, "add", "README.md")
        git(self.repo, "commit", "-m", "init")
        self.harness = self.repo / "harness"
        self.harness.mkdir()
        (self.harness / "HUMAN.md").write_text("human\n", encoding="utf-8")
        real = harness_dir()
        for rel in REGISTERED_P_REL:
            dest = self.harness / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes((real / rel).read_bytes())
        for name in ("config.json",):
            (self.harness / name).write_bytes((real / name).read_bytes())
        for sub in ("seat-prompt", "arms"):
            shutil.copytree(real / sub, self.harness / sub, dirs_exist_ok=True)
        acc = self.held / "acceptance"
        acc.mkdir(parents=True)
        (acc / "f1.spec.ts").write_text("export {}\n", encoding="utf-8")
        (acc / "f1-prime.spec.ts").write_text("export {}\n", encoding="utf-8")
        (acc / "helpers.ts").write_text("export {}\n", encoding="utf-8")
        (acc / "playwright.config.ts").write_text("export {}\n", encoding="utf-8")
        spec = self.held / "score" / "specimens"
        spec.mkdir(parents=True)
        (spec / "EXPECTED.json").write_text("{}\n", encoding="utf-8")
        (self.held / "score" / "test_spec_coverage.py").write_text("import unittest\n", encoding="utf-8")
        payload = register_mod.build_payload(self.held, self.repo, registration=1, supersedes=None)
        (self.evidence / "pre-registration.json").write_text(
            json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        preflight = self.evidence / "preflight" / "test-preflight.txt"
        preflight.write_text("ok\n", encoding="utf-8")
        future = time.time() + 3600
        os.utime(preflight, (future, future))
        self.cfg = {
            "model": PINNED_MODEL,
            "fixture": {"remote": "origin", "sha": "7dc3d08df3e41807b1b575b738e8afb5f7990b93"},
            "seat_wall_minutes": 60,
            "spawn_adapter": "run/adapters/cursor_rest.py",
            "branch_pattern": "trial/{arm}/{n}",
        }
        self._hd = mock.patch.object(spawn_mod, "harness_dir", return_value=self.harness)
        self._hd.start()
        self.addCleanup(self._hd.stop)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _check(self, *, n: int | str = 1, env=None, **kwargs):
        defaults = dict(
            n=n,
            repo=self.repo,
            evidence=self.evidence,
            held=self.held,
            env=env if env is not None else {"CURSOR_API_KEY": "k"},
            verify_public=lambda: None,
            freeze=lambda: None,
        )
        defaults.update(kwargs)
        return spawn_mod.check_preconditions(self.cfg, **defaults)

    def test_v1_digest_mismatch_exits_2(self) -> None:
        (self.held / "acceptance" / "f1.spec.ts").write_text("export { changed }\n", encoding="utf-8")
        with self.assertRaises(spawn_mod.PreconditionError) as ctx:
            self._check()
        self.assertIn("(1)", ctx.exception.name)

    def test_verify_public_failure_exits_2(self) -> None:
        def boom() -> None:
            raise SystemExit(EXIT_PRECONDITION)

        with self.assertRaises(spawn_mod.PreconditionError) as ctx:
            self._check(verify_local=lambda: None, verify_public=boom)
        self.assertIn("(2)", ctx.exception.name)

    def test_v2_digest_mismatch_exits_2(self) -> None:
        bad = register_mod.build_payload(self.held, self.repo, registration=2, supersedes=None)
        (self.evidence / "pre-registration-2.json").write_text(
            json.dumps(bad, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        (self.held / "acceptance" / "f1.spec.ts").write_text("export { v2 }\n", encoding="utf-8")
        with self.assertRaises(spawn_mod.PreconditionError) as ctx:
            self._check(verify_local=lambda: None)
        self.assertIn("(3)", ctx.exception.name)

    def test_h_path_in_remote_history_exits_2(self) -> None:
        planted = self.repo / "harness" / "acceptance" / "secret.spec.ts"
        planted.parent.mkdir(parents=True, exist_ok=True)
        planted.write_text("held-out body\n", encoding="utf-8")
        git(self.repo, "add", "-f", "harness/acceptance/secret.spec.ts")
        git(self.repo, "commit", "-m", "plant H")
        with self.assertRaises(spawn_mod.PreconditionError) as ctx:
            self._check(verify_local=lambda: None)
        self.assertIn("(5)", ctx.exception.name)

    def test_preflight_older_than_h_mtime_exits_2(self) -> None:
        preflight = self.evidence / "preflight" / "test-preflight.txt"
        past = time.time() - 100
        os.utime(preflight, (past, past))
        now = time.time()
        for rel in H_REL_PATHS:
            p = self.held / rel
            if p.is_dir():
                for child in p.rglob("*"):
                    if child.is_file():
                        os.utime(child, (now, now))
            elif p.is_file():
                os.utime(p, (now, now))
        with self.assertRaises(spawn_mod.PreconditionError) as ctx:
            self._check(verify_local=lambda: None)
        self.assertIn("(6)", ctx.exception.name)

    def test_human_md_after_trial2_exits_2(self) -> None:
        remote = self.tmp / "bare.git"
        remote.mkdir()
        git(remote, "init", "--bare")
        git(self.repo, "remote", "add", "origin", str(remote))
        git(self.repo, "push", "-u", "origin", "main")
        (self.evidence / "spawn-log.jsonl").write_text(
            json.dumps({"arm": "conductor", "n": "2", "phase": "after", "at": "2026-09-01T00:00:00Z"}) + "\n",
            encoding="utf-8",
        )
        env = {
            "GIT_AUTHOR_DATE": "2026-09-02T00:00:00",
            "GIT_COMMITTER_DATE": "2026-09-02T00:00:00",
        }
        (self.harness / "HUMAN.md").write_text("late\n", encoding="utf-8")
        subprocess.run(
            ["git", "add", "harness/HUMAN.md"],
            cwd=str(self.repo),
            check=True,
            env={**os.environ, **env},
        )
        subprocess.run(
            ["git", "commit", "-m", "HUMAN.md: late"],
            cwd=str(self.repo),
            check=True,
            env={**os.environ, **env, "GIT_AUTHOR_EMAIL": "a@b.c", "GIT_AUTHOR_NAME": "Apricode"},
        )
        git(self.repo, "push", "origin", "main")
        with self.assertRaises(spawn_mod.PreconditionError) as ctx:
            self._check(n=2, verify_local=lambda: None)
        self.assertIn("(7)", ctx.exception.name)

    def test_model_not_pinned_exits_2(self) -> None:
        self.cfg = dict(self.cfg)
        self.cfg["model"] = "other-model"
        with self.assertRaises(spawn_mod.PreconditionError) as ctx:
            self._check(verify_local=lambda: None)
        self.assertIn("(8)", ctx.exception.name)

    def test_forbidden_provider_keys_exit_2(self) -> None:
        for name in (
            "CLAUDE_API_KEY",
            "ANTHROPIC_API_KEY",
            "OPENAI_API_KEY",
            "GEMINI_API_KEY",
            "GROK_API_KEY",
            "XAI_API_KEY",
        ):
            with self.subTest(name=name):
                with self.assertRaises(spawn_mod.PreconditionError) as ctx:
                    self._check(verify_local=lambda: None, env={name: "secret", "CURSOR_API_KEY": "k"})
                self.assertIn("(9)", ctx.exception.name)

    def test_ok_when_preconditions_hold(self) -> None:
        self._check(verify_local=lambda: None)

    def test_fake_adapter_no_live_api(self) -> None:
        adapter = self.tmp / "fake_adapter.py"
        adapter.write_text(
            "import json, sys\n"
            "sys.stdin.read()\n"
            "print(json.dumps({'seat_id': 'fake-1', 'spawned_at': '2026-09-05T00:00:00Z', 'model': 'grok-4.6:high'}))\n",
            encoding="utf-8",
        )
        os.environ["HARNESS_RUN_DIR"] = str(self.evidence)
        os.environ["HARNESS_HELD_OUT"] = str(self.held)
        try:
            trial = spawn_mod.spawn_one(
                "gatekit",
                1,
                self.cfg,
                adapter=adapter,
            )
        finally:
            os.environ.pop("HARNESS_RUN_DIR", None)
            os.environ.pop("HARNESS_HELD_OUT", None)
        self.assertEqual(trial["seat_id"], "fake-1")
        self.assertTrue((self.evidence / "trials" / "gatekit" / "1" / "trial.json").is_file())


if __name__ == "__main__":
    unittest.main()
