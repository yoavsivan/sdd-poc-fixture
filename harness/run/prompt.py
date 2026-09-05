"""Render seat-prompt/template.md + arm block + briefs + HUMAN.md.

Make target: used by spawn.py / trial.py.
Inputs: seat-prompt/, features/, HUMAN.md, arms/*.lock, config.json.
Outputs: evidence/trials/<arm>/<n>/prompt.md. Exit: 0 ok · 1 usage · 2 leftover {{.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping

from run.common import (
    EXIT_PRECONDITION,
    EXIT_USAGE,
    die,
    harness_dir,
    held_out_dir,
    write_text,
)


REQUIRED_LOCK_FIELDS = (
    "arm",
    "upstream",
    "commit",
    "install",
    "protocol_files",
    "stock_sequence_f1",
    "stock_sequence_f1p",
    "spec_root",
)


def load_lock(arm: str, *, root: Path | None = None) -> dict[str, Any]:
    path = (root or harness_dir()) / "arms" / f"{arm}.lock"
    if not path.is_file():
        die(EXIT_USAGE, f"missing lock: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    missing = [f for f in REQUIRED_LOCK_FIELDS if f not in data]
    if missing:
        die(EXIT_USAGE, f"lock missing field: {missing[0]}")
    return data


def _read(path: Path) -> str:
    if not path.is_file():
        die(EXIT_USAGE, f"missing file: {path}")
    return path.read_text(encoding="utf-8")


def render_arm_block(arm: str, *, root: Path | None = None) -> str:
    base = root or harness_dir()
    lock = load_lock(arm, root=base)
    block_path = base / "seat-prompt" / f"{arm}.md"
    text = _read(block_path)
    install = "\n".join(lock["install"])
    protocol = "\n".join(f"- {p}" for p in lock["protocol_files"])
    f1 = ", ".join(lock["stock_sequence_f1"])
    f1p = ", ".join(lock["stock_sequence_f1p"])
    filled = (
        text.replace("{{install}}", install)
        .replace("{{protocol_files}}", protocol)
        .replace("{{stock_sequence_f1}}", f1)
        .replace("{{stock_sequence_f1p}}", f1p)
        .replace("{{spec_root}}", str(lock["spec_root"]))
        .replace("{{commit}}", str(lock["commit"]))
        .replace("{{upstream}}", str(lock["upstream"]))
    )
    return filled


def held_out_canary_lines(held: Path) -> list[str]:
    lines: list[str] = []
    if not held.exists():
        return lines
    for path in sorted(held.rglob("*")):
        if path.is_file():
            for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
                s = line.strip()
                if s:
                    lines.append(s)
    return lines


def render_prompt(
    arm: str,
    n: int | str,
    cfg: Mapping[str, Any],
    *,
    root: Path | None = None,
    wall_minutes: int | None = None,
    held: Path | None = None,
) -> str:
    base = root or harness_dir()
    template = _read(base / "seat-prompt" / "template.md")
    human = _read(base / "HUMAN.md")
    f1 = _read(base / "features" / "F1.md")
    f1p = _read(base / "features" / "F1-prime.md")
    arm_block = render_arm_block(arm, root=base)
    branch = str(cfg.get("branch_pattern") or "trial/{arm}/{n}").format(arm=arm, n=n)
    wall = wall_minutes if wall_minutes is not None else int(cfg["seat_wall_minutes"])
    model = str(cfg["model"])
    gatekit_url = "<GATEKIT_URL>"
    filled = (
        template.replace("{{arm}}", arm)
        .replace("{{n}}", str(n))
        .replace("{{branch}}", branch)
        .replace("{{wall_minutes}}", str(wall))
        .replace("{{model}}", model)
        .replace("{{arm_block}}", arm_block)
        .replace("{{f1_brief}}", f1)
        .replace("{{f1p_brief}}", f1p)
        .replace("{{human_md}}", human)
        .replace("{{gatekit_url}}", gatekit_url)
    )
    if "{{" in filled:
        die(EXIT_PRECONDITION, "unresolved placeholder remains")
    canary_held = held if held is not None else held_out_dir(cfg)
    for line in held_out_canary_lines(canary_held):
        if line in filled:
            die(EXIT_PRECONDITION, "prompt contains a held-out line")
    return filled


def write_prompt(
    arm: str,
    n: int | str,
    cfg: Mapping[str, Any],
    dest: Path,
    **kwargs: Any,
) -> str:
    text = render_prompt(arm, n, cfg, **kwargs)
    write_text(dest, text)
    return text
