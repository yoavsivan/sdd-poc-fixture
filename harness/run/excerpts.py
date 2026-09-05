"""Deterministic transcript excerpt selection.

Make targets: excerpts, example-e2, example-e3.
Inputs: transcript.json (+ decisions-derived.json for decision class).
Outputs: transcript-excerpts.md with `### turn <i> (<role>)` headers.
Exit: 0 ok · 1 usage · 2 missing transcript.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable

from run.common import (
    ARMS,
    EXIT_OK,
    EXIT_PRECONDITION,
    EXIT_USAGE,
    die,
    read_json,
    run_dir,
    write_text,
)
from run.sanitize import sanitize_text


STOCK_RE = re.compile(r"(?m)^(conductor-|/speckit\.|gatekit )")
DONE_RE = re.compile(r"gatekit: (REJECT|PASS) done")


def cap_lines(text: str, limit: int = 40) -> str:
    lines = text.splitlines()
    if len(lines) <= limit:
        return text
    omitted = len(lines) - limit
    keep = limit // 2
    return "\n".join(lines[:keep] + [f"[… {omitted} lines omitted]"] + lines[-keep:])


def turns_of(transcript: dict[str, Any]) -> list[dict[str, Any]]:
    return list(transcript.get("turns") or [])


def classify_decision_indices(turns: list[dict[str, Any]]) -> set[int]:
    from score.decisions import classify_turn

    hits: set[int] = set()
    for t in turns:
        if t.get("role") == "assistant" and classify_turn(str(t.get("text") or "")):
            hits.add(int(t.get("index", 0)))
    return hits


def select_indices(turns: list[dict[str, Any]], kind: str | None = None) -> list[int]:
    decided = classify_decision_indices(turns)
    chosen: list[int] = []

    def add(i: int) -> None:
        if i not in chosen:
            chosen.append(i)

    assistants = [int(t.get("index", 0)) for t in turns if t.get("role") == "assistant"]
    for t in turns:
        i = int(t.get("index", 0))
        text = str(t.get("text") or "")
        if kind in (None, "decision") and i in decided:
            add(i)
            add(i + 1)
        if kind in (None, "stock") and STOCK_RE.search(text) and t.get("role") == "assistant":
            add(i)
        if kind in (None, "gatekit-done") and DONE_RE.search(text):
            add(i)
    if kind is None and assistants:
        add(assistants[0])
        add(assistants[-1])
    if kind == "gatekit-done":
        chosen = [i for i in chosen if any(int(t.get("index", 0)) == i and DONE_RE.search(str(t.get("text") or "")) for t in turns)]
    return sorted(chosen)


def render_excerpts(transcript: dict[str, Any], kind: str | None = None) -> str:
    turns = turns_of(transcript)
    by_index = {int(t.get("index", i)): t for i, t in enumerate(turns)}
    indices = select_indices(turns, kind)
    parts = []
    for i in indices:
        t = by_index.get(i)
        if not t:
            continue
        role = t.get("role") or "assistant"
        body = cap_lines(str(t.get("text") or ""))
        parts.append(f"### turn {i} ({role})\n\n{body}")
    trailer = (
        f"\n\nturns total: {len(turns)}; excerpts emitted: {len(parts)}; "
        f"decision turns: {len(classify_decision_indices(turns))}\n"
    )
    text = "\n\n".join(parts) + trailer
    cleaned, _ = sanitize_text(text)
    return cleaned


def most_stops_trial(evidence: Path) -> tuple[str, str]:
    best: tuple[int, str, str] | None = None
    trials = evidence / "trials"
    if not trials.is_dir():
        die(EXIT_PRECONDITION, "no trials")
    for arm in ARMS:
        arm_dir = trials / arm
        if not arm_dir.is_dir():
            continue
        for n_dir in sorted(arm_dir.iterdir(), key=lambda p: p.name):
            derived = n_dir / "decisions-derived.json"
            if not derived.is_file():
                continue
            data = read_json(derived)
            count = int(data.get("counts_derived") or data.get("derived_count") or 0)
            key = ( -count, arm, n_dir.name)
            if best is None or key < ( -best[0], best[1], best[2] )[0:3] and False:
                pass
            candidate = (count, arm, n_dir.name)
            if best is None or candidate[0] > best[0] or (
                candidate[0] == best[0] and (candidate[1], candidate[2]) < (best[1], best[2])
            ):
                best = candidate
    if not best:
        die(EXIT_PRECONDITION, "no derived decisions")
    return best[1], best[2]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--arm")
    parser.add_argument("--n")
    parser.add_argument("--select", choices=["gatekit-done", "decision", "stock"])
    parser.add_argument("--most-stops", action="store_true")
    parser.add_argument("--transcript")
    args = parser.parse_args(argv)
    evidence = run_dir()
    arm, n = args.arm, args.n
    if args.most_stops:
        arm, n = most_stops_trial(evidence)
    if args.transcript:
        path = Path(args.transcript)
        dest = path.with_name("transcript-excerpts.md")
    else:
        if not arm or not n:
            die(EXIT_USAGE, "--arm and --n required unless --most-stops")
        dest_dir = evidence / "trials" / arm / str(n)
        path = dest_dir / "transcript.json"
        dest = dest_dir / "transcript-excerpts.md"
    if not path.is_file():
        die(EXIT_PRECONDITION, f"missing {path}")
    text = render_excerpts(read_json(path), args.select)
    write_text(dest, text)
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
