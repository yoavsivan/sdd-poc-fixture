"""Poll adapter status until the seat finishes or the wall+grace elapses.

Make target: called by trial.py.
Inputs: trial.json, config poll_interval_seconds / seat_wall_grace_minutes.
Outputs: updated trial.json (finished_at, finished_at_source, wall_exceeded, messages).
Exit: 0 ok · 1 usage · 2 missing trial.json · 3 adapter.
Idempotent: state lives on disk; a restart resumes from trial.json.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from run.common import (
    EXIT_ENVIRONMENT,
    EXIT_OK,
    EXIT_PRECONDITION,
    EXIT_USAGE,
    die,
    load_config,
    read_json,
    run_dir,
    spawn_adapter_path,
    utc_now,
    write_json,
)


def parse_z(stamp: str) -> datetime:
    stamp = stamp.replace("Z", "+00:00")
    return datetime.fromisoformat(stamp)


def adapter_status(adapter: Path, seat: str) -> dict:
    proc = subprocess.run(
        [sys.executable, str(adapter), "status", "--seat", seat],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        die(EXIT_ENVIRONMENT, "adapter status failed")
    return json.loads(proc.stdout)


def adapter_followup(adapter: Path, seat: str, text: str) -> None:
    proc = subprocess.run(
        [sys.executable, str(adapter), "followup", "--seat", seat],
        input=text,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        die(EXIT_ENVIRONMENT, "adapter followup failed")


def wait_for(arm: str, n: int | str, cfg: dict, *, sleep_fn=time.sleep, now_fn=utc_now) -> dict:
    dest = run_dir() / "trials" / arm / str(n) / "trial.json"
    if not dest.is_file():
        die(EXIT_PRECONDITION, f"missing {dest}")
    trial = read_json(dest)
    if trial.get("finished_at"):
        return trial
    adapter = spawn_adapter_path(cfg)
    seat = trial.get("seat_id")
    if not seat:
        die(EXIT_PRECONDITION, "trial.json has no seat_id")
    wall = int(trial.get("wall_minutes") or cfg["seat_wall_minutes"])
    grace = int(cfg.get("seat_wall_grace_minutes") or 10)
    poll = int(cfg.get("poll_interval_seconds") or 120)
    spawned = parse_z(trial["spawned_at"])
    stop_sent = False
    while True:
        status = adapter_status(adapter, seat)
        state = str(status.get("state") or "UNKNOWN")
        if status.get("messages") is not None:
            trial["messages"] = status["messages"]
        if status.get("credits_reported") is not None:
            trial["credits_reported"] = status["credits_reported"]
        now = parse_z(now_fn())
        elapsed_min = (now - spawned).total_seconds() / 60.0
        if state == "FINISHED":
            trial["finished_at"] = status.get("finished_at") or now_fn()
            trial["finished_at_source"] = "adapter"
            trial["wall_exceeded"] = False
            write_json(dest, trial)
            return trial
        if state in {"ERROR", "EXPIRED"}:
            trial["finished_at"] = status.get("finished_at") or now_fn()
            trial["finished_at_source"] = "adapter"
            trial["invalid_reason"] = f"seat-{state.lower()}"
            write_json(dest, trial)
            return trial
        if elapsed_min >= wall and not stop_sent:
            adapter_followup(adapter, seat, "Time is up")
            stop_sent = True
            trial["stop_followup_sent"] = True
            write_json(dest, trial)
        if elapsed_min >= wall + grace:
            trial["finished_at"] = now_fn()
            trial["finished_at_source"] = "wall+grace"
            trial["wall_exceeded"] = True
            write_json(dest, trial)
            return trial
        sleep_fn(poll)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--arm", required=True)
    parser.add_argument("--n", required=True)
    args = parser.parse_args(argv)
    cfg = load_config()
    wait_for(args.arm, args.n, cfg)
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
