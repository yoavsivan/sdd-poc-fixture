"""Audit origin/main for the two freeze exceptions.

Make target: freeze-check (also spawn precondition 4).
Inputs: origin/main commits after the pre-trial push; evidence/spawn-log.jsonl.
Outputs: evidence/freeze-exceptions.jsonl. Exit: 0 ok · 2 any other commit.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from run.common import (
    EXIT_OK,
    EXIT_PRECONDITION,
    die,
    repo_root,
    run_dir,
    utc_now,
    write_json,
)

EXCEPTION_II = {
    "harness/features/F1.md",
    "harness/features/F1-prime.md",
    "harness/score/RUBRIC.md",
    "harness/pre-registration-2.json",
}

FORBIDDEN_PREFIXES = (
    "harness/score/",
    "harness/run/",
    "harness/seat-prompt/",
    "harness/arms/",
    "src/",
)


def git(args: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=str(cwd), capture_output=True, text=True, check=False)


def commit_files(repo: Path, sha: str) -> list[str]:
    proc = git(["diff-tree", "--no-commit-id", "--name-only", "-r", sha], repo)
    return [ln.strip() for ln in proc.stdout.splitlines() if ln.strip()]


def first_trial2_iso(evidence: Path) -> str | None:
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


def trials_spawned(evidence: Path) -> list[str]:
    log = evidence / "spawn-log.jsonl"
    out: list[str] = []
    if not log.is_file():
        return out
    for line in log.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if row.get("phase") == "after" and not row.get("probe"):
            out.append(f"{row.get('arm')}/{row.get('n')}")
    return out


def classify(files: list[str], message: str) -> str | None:
    s = set(files)
    if s == {"harness/HUMAN.md"} or s == {"HUMAN.md"}:
        return "i"
    if s == EXCEPTION_II:
        return "ii"
    return None


def window_commits(repo: Path) -> list[dict[str, str]]:
    marker = git(["log", "origin/main", "--format=%H", "--", "harness/pre-registration.json"], repo)
    shas = [ln.strip() for ln in marker.stdout.splitlines() if ln.strip()]
    if not shas:
        rng = "origin/main"
    else:
        rng = f"{shas[-1]}..origin/main"
    proc = git(["log", rng, "--format=%H\t%cI\t%s"], repo)
    rows = []
    for line in proc.stdout.splitlines():
        if not line.strip():
            continue
        sha, iso, msg = (line.split("\t", 2) + ["", ""])[:3]
        rows.append({"sha": sha, "iso": iso, "msg": msg})
    rows.reverse()
    return rows


def run_check(*, repo: Path | None = None, evidence: Path | None = None) -> list[dict[str, Any]]:
    repo = repo or repo_root()
    evidence = evidence or run_dir()
    first2 = first_trial2_iso(evidence)
    spawned = trials_spawned(evidence)
    exceptions: list[dict[str, Any]] = []
    for row in window_commits(repo):
        files = commit_files(repo, row["sha"])
        kind = classify(files, row["msg"])
        if kind is None:
            die(EXIT_PRECONDITION, f"freeze violation {row['sha']}: {files}")
        if kind == "i" and first2:
            iso = row["iso"].replace("+00:00", "Z")
            if iso >= first2:
                die(EXIT_PRECONDITION, f"HUMAN.md commit after trial-2 spawn: {row['sha']}")
        for path in files:
            if kind != "ii" and path.startswith("harness/score/") and path.endswith(".py"):
                die(EXIT_PRECONDITION, f"scorer touched: {path}")
            if any(path.startswith(p) for p in FORBIDDEN_PREFIXES) and path not in EXCEPTION_II:
                if not (kind == "i" and path.endswith("HUMAN.md")):
                    die(EXIT_PRECONDITION, f"forbidden path: {path}")
        exceptions.append(
            {
                "files": files,
                "kind": kind,
                "reason": row["msg"],
                "sha": row["sha"],
                "trials_spawned": spawned,
                "utc": row["iso"].replace("+00:00", "Z") if row["iso"].endswith("+00:00") else row["iso"],
            }
        )
    dest = evidence / "freeze-exceptions.jsonl"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("".join(json.dumps(e, sort_keys=True) + "\n" for e in exceptions), encoding="utf-8")
    print(dest.name)
    return exceptions


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", action="store_true")
    args = parser.parse_args(argv)
    rows = run_check()
    if args.report:
        print(json.dumps(rows, indent=2, sort_keys=True))
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
