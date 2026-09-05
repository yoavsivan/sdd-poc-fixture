"""One trial end to end: spawn → wait → collect → rebuild both tags → score.

Make targets: trial, trial2, dry-run, tiebreak, exhibit.
Inputs: ARM, N, config.json. Does not spawn live seats from unit tests.
Outputs: evidence/trials/<arm>/<n>/. Exit: 0 ok · 1 usage · 2 precondition · 3 env.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from run.common import (
    ARMS,
    EXIT_OK,
    EXIT_PRECONDITION,
    EXIT_USAGE,
    die,
    load_config,
    read_json,
    run_dir,
)
from run import collect as collect_mod
from run import rebuild as rebuild_mod
from run import schedule as schedule_mod
from run import spawn as spawn_mod
from run import wait as wait_mod


def score_trial(arm: str, n: int | str) -> None:
    dest = run_dir() / "trials" / arm / str(n)
    tags = {}
    tags_path = dest / "tags.json"
    if tags_path.is_file():
        tags = read_json(tags_path)
    from score.spec_coverage import score_repo
    from score.decisions import score_transcript

    cfg = load_config()
    base = cfg["fixture"]["sha"]
    for label, sha in (("f1", tags.get("done-f1")), ("f1p", tags.get("done-f1p"))):
        if not sha:
            continue
        wt = run_dir() / "build" / f"{arm}-{n}-done-{label}"
        if wt.is_dir():
            out = score_repo(wt, base, sha, arm)
            (dest / f"coverage-{label}.json").write_text(
                json.dumps(out, indent=2, sort_keys=True) + "\n", encoding="utf-8"
            )
    tr = dest / "transcript.json"
    selfp = dest / "decisions.jsonl"
    if tr.is_file():
        derived = score_transcript(tr, selfp if selfp.is_file() else None)
        (dest / "decisions-derived.json").write_text(
            json.dumps(derived, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )


def run_trial(arm: str, n: int | str, cfg: dict, *, skip_spawn: bool = False) -> None:
    schedule_mod.require_arm(arm)
    if not skip_spawn:
        spawn_mod.check_preconditions(cfg, n=n)
        spawn_mod.spawn_one(arm, n, cfg)
        wait_mod.wait_for(arm, n, cfg)
    collect_mod.collect(arm, n, cfg)
    tags_path = run_dir() / "trials" / arm / str(n) / "tags.json"
    tags = read_json(tags_path) if tags_path.is_file() else {}
    if tags.get("done-f1"):
        rebuild_mod.rebuild(arm, n, tags["done-f1"], "done-f1", cfg)
    if tags.get("done-f1p"):
        rebuild_mod.rebuild(arm, n, tags["done-f1p"], "done-f1p", cfg)
    score_trial(arm, n)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--arm")
    parser.add_argument("--n", default="1")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--tiebreak", action="store_true")
    parser.add_argument("--exhibit", action="store_true")
    args = parser.parse_args(argv)
    cfg = load_config()
    if args.exhibit:
        spawn_mod.check_preconditions(cfg, n="1")
        spawn_mod.spawn_one("gatekit", "exhibit", cfg)
        return EXIT_OK
    if args.tiebreak:
        order = schedule_mod.tiebreak_order(run_dir() / "tiebreak-triggers.jsonl")
        for arm in schedule_mod.cap_tiebreak(order):
            run_trial(arm, 3, cfg)
            time.sleep(int(cfg.get("spawn_stagger_seconds") or 0))
        return EXIT_OK
    if args.all:
        order = schedule_mod.order_for_n(args.n, cfg)
        for arm in order:
            run_trial(arm, args.n, cfg)
            time.sleep(int(cfg.get("spawn_stagger_seconds") or 0))
        return EXIT_OK
    if not args.arm:
        die(EXIT_USAGE, "--arm is required")
    run_trial(args.arm, args.n, cfg)
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
