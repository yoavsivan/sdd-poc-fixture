"""Shared paths, config load, IO and exit codes for every run/ entrypoint.

Make targets call the modules; this file owns no command of its own.
Inputs: harness/config.json, env HARNESS_RUN_DIR / HARNESS_HELD_OUT /
HARNESS_SPAWN_ADAPTER / HARNESS_SEAT_WALL_MINUTES / HARNESS_SCORE_DIR /
HARNESS_BLOCKLIST.
Outputs: none (library). Exit codes: 0 ok · 1 usage · 2 precondition · 3 environment.
"""
from __future__ import annotations

import csv
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

EXIT_OK = 0
EXIT_USAGE = 1
EXIT_PRECONDITION = 2
EXIT_ENVIRONMENT = 3

ARMS = ["conductor", "gatekit", "spec-kit"]
PINNED_MODEL = "grok-4.6:high"
FIXTURE_TAG = "fixture-v1"
FIXTURE_SHA = "7dc3d08df3e41807b1b575b738e8afb5f7990b93"
GATEKIT_TAG = "v0.1.0"
GATEKIT_SHA = "3415666df5ccc0382e7e33095aa4ee15389412bd"

H_REL_PATHS = (
    "acceptance",
    "score/specimens",
    "score/test_spec_coverage.py",
)

REGISTERED_P_REL = (
    "score/RUBRIC.md",
    "features/F1.md",
    "features/F1-prime.md",
)

KNOWN_CONFIG_KEYS = {
    "harness_version",
    "model",
    "fixture",
    "arms",
    "spawn_order",
    "branch_pattern",
    "tag_names",
    "pushed_tag_pattern",
    "seat_wall_minutes",
    "seat_wall_grace_minutes",
    "spawn_stagger_seconds",
    "poll_interval_seconds",
    "spawn_adapter",
    "held_out_default",
    "results_dir",
    "registrations",
}

FORBIDDEN_KEY_RE = r"^(CLAUDE|ANTHROPIC|OPENAI|GEMINI|GROK|XAI)_API_KEY$"


def harness_dir() -> Path:
    return Path(__file__).resolve().parent.parent


def repo_root() -> Path:
    return harness_dir().parent


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def die(code: int, msg: str) -> None:
    sys.stderr.write(msg.rstrip() + "\n")
    raise SystemExit(code)


def run_dir() -> Path:
    raw = os.environ.get("HARNESS_RUN_DIR")
    if raw:
        return Path(raw).expanduser().resolve()
    return (harness_dir() / "../evidence").resolve()


def held_out_dir(cfg: Mapping[str, Any] | None = None) -> Path:
    raw = os.environ.get("HARNESS_HELD_OUT")
    if raw:
        return Path(raw).expanduser().resolve()
    default = (cfg or {}).get("held_out_default") or "../evidence/held-out/harness"
    return (harness_dir() / default).resolve()


def blocklist_path() -> Path:
    raw = os.environ.get("HARNESS_BLOCKLIST")
    if raw:
        return Path(raw).expanduser().resolve()
    return run_dir() / "blocklist.txt"


def spawn_adapter_path(cfg: Mapping[str, Any]) -> Path:
    raw = os.environ.get("HARNESS_SPAWN_ADAPTER")
    if raw:
        return Path(raw).expanduser().resolve()
    rel = cfg.get("spawn_adapter") or "run/adapters/cursor_rest.py"
    return (harness_dir() / rel).resolve()


def seat_wall_minutes(cfg: Mapping[str, Any]) -> tuple[int, str]:
    env = os.environ.get("HARNESS_SEAT_WALL_MINUTES")
    if env:
        return int(env), "env"
    return int(cfg["seat_wall_minutes"]), "config"


def load_config(path: Path | None = None) -> dict[str, Any]:
    cfg_path = path or (harness_dir() / "config.json")
    if not cfg_path.is_file():
        die(EXIT_ENVIRONMENT, f"missing config: {cfg_path}")
    data = json.loads(cfg_path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        die(EXIT_USAGE, "config.json must be an object")
    unknown = set(data) - KNOWN_CONFIG_KEYS
    if unknown:
        die(EXIT_USAGE, f"unknown config key: {sorted(unknown)[0]}")
    model = data.get("model")
    if model != PINNED_MODEL:
        die(EXIT_PRECONDITION, "pinned model mismatch")
    arms = data.get("arms")
    if not isinstance(arms, list) or arms != sorted(arms):
        die(EXIT_USAGE, "arms must be sorted")
    if arms != ARMS:
        die(EXIT_USAGE, "arms must match ARMS")
    spawn_order = data.get("spawn_order") or {}
    for key in ("1", "2"):
        order = spawn_order.get(key)
        if not isinstance(order, list) or sorted(order) != sorted(ARMS):
            die(EXIT_USAGE, f"spawn_order.{key} must be a permutation of arms")
    return data


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, indent=2, sort_keys=True) + "\n"
    path.write_text(text, encoding="utf-8")
    print(rel_display(path))


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not text.endswith("\n"):
        text += "\n"
    path.write_text(text, encoding="utf-8")
    print(rel_display(path))


def rel_display(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(repo_root()))
    except ValueError:
        try:
            return str(path.resolve().relative_to(run_dir()))
        except ValueError:
            return str(path)


def sh(
    args: Sequence[str],
    *,
    cwd: Path | None = None,
    check: bool = True,
    capture: bool = True,
    env: Mapping[str, str] | None = None,
    timeout: int | None = None,
) -> subprocess.CompletedProcess[str]:
    merged = dict(os.environ)
    if env:
        merged.update(env)
    proc = subprocess.run(
        list(args),
        cwd=str(cwd) if cwd else None,
        check=False,
        capture_output=capture,
        text=True,
        env=merged,
        timeout=timeout,
    )
    if check and proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(f"command failed ({proc.returncode}): {' '.join(args)}\n{err}")
    return proc


def write_csv(path: Path, header: Sequence[str], rows: Iterable[Sequence[Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh, lineterminator="\n")
        writer.writerow(list(header))
        for row in rows:
            writer.writerow(["" if c is None else c for c in row])
    print(rel_display(path))


def parse_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def trial_dir(arm: str, n: int | str, *, evidence: Path | None = None) -> Path:
    root = evidence or (run_dir() / "trials")
    return root / arm / str(n)
