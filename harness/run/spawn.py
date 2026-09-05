"""Spawn a trial seat after the nine preconditions.

Make targets: trial, dry-run, preflight-docker (--probe).
Inputs: config.json, registrations, freeze_check, H isolation, preflight stamp,
HUMAN.md freeze, pinned model, adapter executable.
Outputs: evidence/trials/<arm>/<n>/trial.json, prompt.md, spawn-log.jsonl.
Exit: 0 ok · 1 usage · 2 precondition · 3 environment.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable

from run.common import (
    EXIT_ENVIRONMENT,
    EXIT_OK,
    EXIT_PRECONDITION,
    EXIT_USAGE,
    FORBIDDEN_KEY_RE,
    H_REL_PATHS,
    PINNED_MODEL,
    die,
    harness_dir,
    held_out_dir,
    load_config,
    repo_root,
    run_dir,
    seat_wall_minutes,
    spawn_adapter_path,
    utc_now,
    write_json,
    write_text,
)
from run import freeze_check as freeze_mod
from run import prompt as prompt_mod
from run import register as register_mod

FORBIDDEN_KEY = re.compile(FORBIDDEN_KEY_RE)


def _git(args: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=str(cwd), capture_output=True, text=True, check=False)


def append_jsonl(path: Path, obj: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(obj, sort_keys=True) + "\n")


def latest_mtime(path: Path) -> float:
    if path.is_file():
        return path.stat().st_mtime
    latest = 0.0
    if path.is_dir():
        for p in path.rglob("*"):
            if p.is_file():
                latest = max(latest, p.stat().st_mtime)
    return latest


def first_trial2_spawn_at(evidence: Path) -> str | None:
    log = evidence / "spawn-log.jsonl"
    if not log.is_file():
        return None
    for line in log.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if str(row.get("n")) == "2" and row.get("phase") == "after":
            return str(row.get("at") or "")
    return None


def human_md_changed_at_or_after(repo: Path, cutoff_iso: str) -> bool:
    proc = _git(
        ["log", "origin/main", "--format=%cI", "--", "harness/HUMAN.md"],
        repo,
    )
    if proc.returncode != 0:
        return False
    for line in proc.stdout.splitlines():
        stamp = line.strip()
        if not stamp:
            continue
        if stamp.replace("+00:00", "Z") >= cutoff_iso:
            return True
    return False


class PreconditionError(Exception):
    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.name = name


def check_preconditions(
    cfg: dict[str, Any],
    *,
    n: int | str,
    probe: bool = False,
    repo: Path | None = None,
    evidence: Path | None = None,
    held: Path | None = None,
    env: dict[str, str] | None = None,
    verify_local: Callable[[], None] | None = None,
    verify_public: Callable[[], None] | None = None,
    freeze: Callable[[], None] | None = None,
) -> None:
    repo = repo or repo_root()
    evidence = evidence or run_dir()
    held = held if held is not None else held_out_dir(cfg)
    environ = env if env is not None else dict(os.environ)

    v1 = evidence / "pre-registration.json"
    if not v1.is_file():
        raise PreconditionError("(1) pre-registration.json missing")
    try:
        if verify_local:
            verify_local()
        else:
            register_mod.verify_local(held, repo, v1)
    except SystemExit:
        raise PreconditionError("(1) verify-local failed") from None

    try:
        if verify_public:
            verify_public()
        else:
            register_mod.verify_public(v1, repo=repo)
    except SystemExit:
        raise PreconditionError("(2) verify-public failed") from None

    v2_public = harness_dir() / "pre-registration-2.json"
    if v2_public.is_file() or (evidence / "pre-registration-2.json").is_file():
        v2 = evidence / "pre-registration-2.json"
        if not v2.is_file():
            raise PreconditionError("(3) pre-registration-2.json missing")
        try:
            register_mod.verify_local(held, repo, v2)
        except SystemExit:
            raise PreconditionError("(3) v2 verify-local failed") from None

    try:
        if freeze:
            freeze()
        else:
            freeze_mod.run_check(repo=repo, evidence=evidence)
    except SystemExit:
        raise PreconditionError("(4) freeze_check failed") from None

    history = _git(
        ["log", "--all", "--", "harness/acceptance", "harness/score/specimens", "harness/score/test_spec_coverage.py"],
        repo,
    )
    if history.stdout.strip():
        raise PreconditionError("(5) H path in remote history")
    tree = _git(["ls-tree", "-r", "origin/main"], repo)
    for rel in H_REL_PATHS:
        needle = f"harness/{rel}"
        for line in tree.stdout.splitlines():
            if needle in line:
                raise PreconditionError("(5) H path in origin/main")

    if not probe:
        preflight = evidence / "preflight" / "test-preflight.txt"
        if not preflight.is_file():
            raise PreconditionError("(6) test-preflight missing")
        stamp = preflight.stat().st_mtime
        h_mtime = 0.0
        for rel in H_REL_PATHS:
            h_mtime = max(h_mtime, latest_mtime(held / rel), latest_mtime(harness_dir() / rel))
        if stamp < h_mtime:
            raise PreconditionError("(6) preflight older than H-file mtime")

    if not probe and str(n) == "2":
        first = first_trial2_spawn_at(evidence)
        if first and human_md_changed_at_or_after(repo, first):
            raise PreconditionError("(7) HUMAN.md changed at or after first trial-2 spawn")

    if cfg.get("model") != PINNED_MODEL:
        raise PreconditionError("(8) model is not grok-4.6:high")

    for key in environ:
        if FORBIDDEN_KEY.match(key):
            raise PreconditionError(f"(9) forbidden {key}")


def adapter_spawn(adapter: Path, *, repo_url: str, ref: str, branch: str, model: str, title: str, prompt: str) -> dict[str, Any]:
    proc = subprocess.run(
        [
            sys.executable,
            str(adapter),
            "spawn",
            "--repo",
            repo_url,
            "--ref",
            ref,
            "--branch",
            branch,
            "--model",
            model,
            "--title",
            title,
        ],
        input=prompt,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        die(EXIT_ENVIRONMENT, f"adapter spawn failed: {(proc.stderr or proc.stdout).strip()}")
    return json.loads(proc.stdout)


def spawn_one(
    arm: str,
    n: int | str,
    cfg: dict[str, Any],
    *,
    probe: bool = False,
    adapter: Path | None = None,
) -> dict[str, Any]:
    evidence = run_dir()
    dest = evidence / "trials" / arm / str(n)
    dest.mkdir(parents=True, exist_ok=True)
    wall, wall_src = seat_wall_minutes(cfg)
    prompt_path = dest / "prompt.md"
    prompt_mod.write_prompt(arm, n, cfg, prompt_path, wall_minutes=wall, root=harness_dir())
    prompt = prompt_path.read_text(encoding="utf-8")
    adapter = adapter or spawn_adapter_path(cfg)
    repo_url = subprocess.run(
        ["git", "remote", "get-url", str(cfg["fixture"]["remote"])],
        cwd=str(repo_root()),
        capture_output=True,
        text=True,
        check=False,
    ).stdout.strip() or "https://github.com/yoavsivan/sdd-poc-fixture.git"
    branch = str(cfg.get("branch_pattern") or "trial/{arm}/{n}").format(arm=arm, n=n)
    if probe:
        branch = "preflight/docker-probe"
    log = evidence / "spawn-log.jsonl"
    append_jsonl(log, {"arm": arm, "at": utc_now(), "n": str(n), "phase": "before", "probe": probe})
    result = adapter_spawn(
        adapter,
        repo_url=repo_url,
        ref=cfg["fixture"]["sha"],
        branch=branch,
        model=cfg["model"],
        title=f"{arm}-{n}" if not probe else "docker-probe",
        prompt=prompt,
    )
    append_jsonl(log, {"arm": arm, "at": utc_now(), "n": str(n), "phase": "after", "probe": probe, "ok": True})
    adapter_name = adapter.name if adapter.resolve() == spawn_adapter_path(cfg).resolve() else "private"
    if os.environ.get("HARNESS_SPAWN_ADAPTER") and Path(os.environ["HARNESS_SPAWN_ADAPTER"]).resolve() != (harness_dir() / cfg["spawn_adapter"]).resolve():
        adapter_name = "private"
    trial = {
        "adapter": adapter_name,
        "arm": arm,
        "branch": branch,
        "cohort": "v2" if (harness_dir() / "pre-registration-2.json").is_file() else "v1",
        "credits_reported": None,
        "finished_at": None,
        "finished_at_source": None,
        "flags": [],
        "invalid_reason": None,
        "messages": None,
        "model": result.get("model") or cfg["model"],
        "n": str(n),
        "probe": probe,
        "role": "scored" if not probe else "probe",
        "seat_id": result.get("seat_id"),
        "spawned_at": result.get("spawned_at") or utc_now(),
        "trial": int(n) if str(n).isdigit() else n,
        "wall_exceeded": False,
        "wall_minutes": wall,
        "wall_minutes_source": wall_src,
    }
    write_json(dest / "trial.json", trial)
    if wall_src == "env":
        append_jsonl(
            evidence / "config-changes.jsonl",
            {"at": utc_now(), "field": "seat_wall_minutes", "source": "env", "value": wall, "arm": arm, "n": str(n)},
        )
    return trial


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--arm")
    parser.add_argument("--n", default="1")
    parser.add_argument("--probe", action="store_true")
    args = parser.parse_args(argv)
    cfg = load_config()
    try:
        check_preconditions(cfg, n=args.n, probe=args.probe)
    except PreconditionError as exc:
        die(EXIT_PRECONDITION, str(exc.name))
    if args.probe:
        spawn_one("gatekit", "probe", cfg, probe=True)
        write_text(run_dir() / "preflight" / "docker-probe.md", "probe seat spawned\n")
        return EXIT_OK
    if not args.arm:
        die(EXIT_USAGE, "ARM is required unless --probe")
    spawn_one(args.arm, args.n, cfg)
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
