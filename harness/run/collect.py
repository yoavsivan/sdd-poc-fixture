"""Fetch a finished trial branch, resolve tags, snapshot specs, write diffs.

Make target: called by trial.py.
Inputs: trial branch trial/<arm>/<n>, .trial/tags.json, RUBRIC excludes/globs.
Outputs: tags.json, diffs, spec snapshots, transcript.json, copies of .trial/*.
Exit: 0 ok · 1 usage · 2 missing branch. Idempotent from evidence.
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
    EXIT_USAGE,
    PINNED_MODEL,
    die,
    harness_dir,
    held_out_dir,
    load_config,
    read_json,
    repo_root,
    run_dir,
    sh,
    spawn_adapter_path,
    write_json,
    write_text,
)


def git(args: list[str], cwd: Path, check: bool = True) -> subprocess.CompletedProcess[str]:
    return sh(["git", *args], cwd=cwd, check=check)


def is_ancestor(repo: Path, ancestor: str, tip: str) -> bool:
    proc = git(["merge-base", "--is-ancestor", ancestor, tip], repo, check=False)
    return proc.returncode == 0


def load_excludes(rubric: Path) -> list[str]:
    from score.spec_coverage import load_rubric_block

    block = load_rubric_block(rubric, "excludes")
    if isinstance(block, list):
        return [str(x) for x in block]
    return [".trial/", "conductor/", "specs/", ".specify/", "features/", ".gatekit/", ".cursor/", "HANDOFF.md"]


def load_globs(rubric: Path, arm: str) -> list[str]:
    from score.spec_coverage import load_rubric_block

    block = load_rubric_block(rubric, "globs")
    if isinstance(block, dict):
        return [str(x) for x in (block.get(arm) or [])]
    return []


def held_out_lines(held: Path) -> set[str]:
    lines: set[str] = set()
    if not held.exists():
        return lines
    for path in held.rglob("*"):
        if path.is_file():
            for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
                s = line.strip()
                if s:
                    lines.add(s)
    return lines


def snapshot_specs(repo: Path, sha: str, globs: list[str], dest: Path) -> list[str]:
    dest.mkdir(parents=True, exist_ok=True)
    matched: list[str] = []
    for pattern in globs:
        proc = git(["ls-tree", "-r", "--name-only", sha], repo, check=False)
        import fnmatch

        for name in proc.stdout.splitlines():
            if fnmatch.fnmatch(name, pattern):
                blob = git(["show", f"{sha}:{name}"], repo, check=False)
                if blob.returncode == 0:
                    out = dest / name
                    out.parent.mkdir(parents=True, exist_ok=True)
                    out.write_text(blob.stdout, encoding="utf-8")
                    matched.append(name)
    return matched


def unmatched_candidates(repo: Path, sha: str, arm: str, matched: list[str]) -> list[str]:
    roots = {"conductor": "conductor/", "spec-kit": "specs/", "gatekit": "features/"}
    root = roots.get(arm, "")
    proc = git(["ls-tree", "-r", "--name-only", sha], repo, check=False)
    extra = []
    matched_set = set(matched)
    for name in proc.stdout.splitlines():
        if root and name.startswith(root) and name not in matched_set:
            extra.append(name)
    return extra


def write_diff(repo: Path, base: str, sha: str, excludes: list[str], dest: Path) -> None:
    pathspecs = [".", *[f":!{e}" for e in excludes]]
    proc = git(["diff", "--unified=0", "--no-color", base, sha, "--", *pathspecs], repo, check=False)
    write_text(dest, proc.stdout or "")


def collect(
    arm: str,
    n: int | str,
    cfg: dict[str, Any],
    *,
    repo: Path | None = None,
    evidence: Path | None = None,
) -> dict[str, Any]:
    repo = repo or repo_root()
    evidence = evidence or run_dir()
    dest = evidence / "trials" / arm / str(n)
    dest.mkdir(parents=True, exist_ok=True)
    trial_path = dest / "trial.json"
    trial = read_json(trial_path) if trial_path.is_file() else {}
    branch = trial.get("branch") or f"trial/{arm}/{n}"
    fetch = git(["fetch", cfg["fixture"]["remote"], branch], repo, check=False)
    if fetch.returncode != 0:
        die(EXIT_PRECONDITION, f"failed to fetch {branch}")
    tip = git(["rev-parse", f"{cfg['fixture']['remote']}/{branch}"], repo, check=False)
    if tip.returncode != 0:
        tip = git(["rev-parse", branch], repo, check=False)
    tip_sha = (tip.stdout or "").strip()
    write_text(dest / "branch.txt", tip_sha)
    show = git(["show", f"{cfg['fixture']['remote']}/{branch}:.trial/tags.json"], repo, check=False)
    if show.returncode != 0:
        show = git(["show", f"{branch}:.trial/tags.json"], repo, check=False)
    if show.returncode != 0:
        tags = {}
    else:
        tags = json.loads(show.stdout)
    record = {"ancestor_ok": True, "done-f1": tags.get("done-f1"), "done-f1p": tags.get("done-f1p")}
    invalid = trial.get("invalid_reason")
    for key in ("done-f1", "done-f1p"):
        sha = tags.get(key)
        if sha and tip_sha and not is_ancestor(repo, sha, tip_sha):
            record["ancestor_ok"] = False
            invalid = "tags-not-on-branch"
    if tags.get("done-f1p") is None:
        record["f1p"] = "n/a"
    write_json(dest / "tags.json", {**tags, **record})

    reported = trial.get("model")
    if reported and reported != PINNED_MODEL:
        invalid = "model-mismatch"

    for name in ("decisions.jsonl", "smoke-before.txt", "f1p-flow.md", "env.txt", "notes.md", "ABORT.md"):
        blob = git(["show", f"{branch}:.trial/{name}"], repo, check=False)
        if blob.returncode == 0:
            write_text(dest / name, blob.stdout)

    rubric = harness_dir() / "score" / "RUBRIC.md"
    excludes = load_excludes(rubric) if rubric.is_file() else []
    globs = load_globs(rubric, arm) if rubric.is_file() else []
    base = cfg["fixture"]["sha"]
    if tags.get("done-f1"):
        write_diff(repo, base, tags["done-f1"], excludes, dest / "diff-f1.patch")
        matched = snapshot_specs(repo, tags["done-f1"], globs, dest / "spec-f1")
        extra = unmatched_candidates(repo, tags["done-f1"], arm, matched)
        write_text(dest / "spec-unmatched-f1.txt", "\n".join(extra))
        if extra:
            trial.setdefault("flags", []).append("spec-layout-review")
    if tags.get("done-f1p"):
        write_diff(repo, base, tags["done-f1p"], excludes, dest / "diff-f1p.patch")
        matched = snapshot_specs(repo, tags["done-f1p"], globs, dest / "spec-f1p")
        extra = unmatched_candidates(repo, tags["done-f1p"], arm, matched)
        write_text(dest / "spec-unmatched-f1p.txt", "\n".join(extra))
        if extra:
            trial.setdefault("flags", []).append("spec-layout-review")

    adapter = spawn_adapter_path(cfg)
    seat = trial.get("seat_id")
    if seat:
        proc = subprocess.run(
            [sys.executable, str(adapter), "conversation", "--seat", seat],
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode == 0:
            conv = json.loads(proc.stdout)
            write_json(dest / "transcript.json", conv)
            forbidden = held_out_lines(held_out_dir(cfg))
            text = json.dumps(conv)
            for line in forbidden:
                if line and line in text:
                    invalid = "acceptance-obtained"
                    break

    if invalid:
        trial["invalid_reason"] = invalid
        trial["role"] = "invalid"
    write_json(trial_path, trial)
    return trial


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--arm", required=True)
    parser.add_argument("--n", required=True)
    args = parser.parse_args(argv)
    cfg = load_config()
    collect(args.arm, args.n, cfg)
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
