"""Interleaved spawn order per trial number; tie-break fire order.

Make target: trial / trial2 / tiebreak (via trial.py).
Inputs: config.json spawn_order; evidence/tiebreak-triggers.jsonl.
Outputs: ordered arm lists. Exit: 0 ok · 1 usage.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping, Sequence

from run.common import ARMS, EXIT_USAGE, die, read_json


def order_for_n(n: int | str, cfg: Mapping[str, Any]) -> list[str]:
    key = str(n)
    spawn = cfg.get("spawn_order") or {}
    if key not in spawn:
        die(EXIT_USAGE, f"no spawn_order for n={n}")
    order = spawn[key]
    if not isinstance(order, list):
        die(EXIT_USAGE, f"spawn_order.{key} is not a list")
    for arm in order:
        if arm not in ARMS:
            die(EXIT_USAGE, f"arm not in ARMS: {arm}")
    return list(order)


def require_arm(arm: str) -> str:
    if arm not in ARMS:
        die(EXIT_USAGE, f"arm not in ARMS: {arm}")
    return arm


def tiebreak_order(
    triggers_path: Path,
    *,
    one_per_arm: bool = True,
) -> list[str]:
    """Order by fired_at; equal timestamps resolve alphabetically.

    At most one seat per arm; never a fourth trial (caller supplies n=3).
    """
    if not triggers_path.is_file():
        return []
    rows: list[dict[str, Any]] = []
    for line in triggers_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(__import__("json").loads(line))
    rows.sort(key=lambda r: (str(r.get("fired_at") or ""), str(r.get("arm") or "")))
    seen: list[str] = []
    for row in rows:
        arm = str(row.get("arm") or "")
        if arm not in ARMS:
            die(EXIT_USAGE, f"arm not in ARMS: {arm}")
        if one_per_arm and arm in seen:
            continue
        seen.append(arm)
    return seen


def cap_tiebreak(arms: Sequence[str]) -> list[str]:
    """One tie-break per arm, never a fourth trial."""
    out: list[str] = []
    for arm in arms:
        require_arm(arm)
        if arm not in out:
            out.append(arm)
    return out
