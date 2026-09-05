"""Transcript-derived decision-point count merged with self-reported jsonl.

Make target: score (decisions.py --json) and scorecard ledger.
Inputs: --transcript JSON, --self decisions.jsonl.
Outputs: derived rows, self rows, merged rows, counts.
Exit: 0 ok · 1 usage · 2 missing transcript.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

MENU_RE = re.compile(r"(?m)^\s*(\d+[\.\)]\s+\S.+){2,}", re.S)
NUMBERED_RE = re.compile(r"(?m)^\s*\d+[\.\)]\s+\S")
APPROVAL_RE = re.compile(r"\b(approve|approval|looks good|shall i (continue|proceed)|ok to proceed)\b", re.I)
QUESTION_RE = re.compile(r"\?\s*$")


def classify_turn(text: str) -> str | None:
    stripped = text.strip()
    if not stripped:
        return None
    numbered = NUMBERED_RE.findall(text)
    if len(numbered) >= 2:
        return "menu"
    if APPROVAL_RE.search(stripped):
        return "approval"
    last = stripped.splitlines()[-1].strip() if stripped.splitlines() else stripped
    if last.endswith("?"):
        return "question"
    return None


def derived_rows(turns: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for t in turns:
        if t.get("role") != "assistant":
            continue
        kind = classify_turn(str(t.get("text") or ""))
        if not kind:
            continue
        excerpt = str(t.get("text") or "").strip().splitlines()
        excerpt_s = " ".join(excerpt)[:200]
        rows.append(
            {
                "excerpt": excerpt_s,
                "source": "derived-only",
                "turn": int(t.get("index", 0)),
                "type": kind,
            }
        )
    return rows


def load_self(path: Path | None) -> list[dict[str, Any]]:
    if not path or not path.is_file():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        rows.append(json.loads(line))
    return rows


def merge(derived: list[dict[str, Any]], self_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    used: set[int] = set()
    merged: list[dict[str, Any]] = []
    for s in self_rows:
        sturn = s.get("turn")
        match = None
        if sturn is not None:
            for i, d in enumerate(derived):
                if i in used:
                    continue
                if abs(int(d["turn"]) - int(sturn)) <= 1:
                    match = d
                    used.add(i)
                    break
        row = {
            "answer": s.get("answer"),
            "excerpt": (match or {}).get("excerpt") or s.get("question"),
            "question": s.get("question"),
            "source": s.get("source") or "default",
            "turn": sturn,
            "type": s.get("type") or (match or {}).get("type"),
        }
        merged.append(row)
    for i, d in enumerate(derived):
        if i in used:
            continue
        merged.append({**d, "source": "derived-only"})
    return merged


def score_transcript(transcript: Path, self_path: Path | None) -> dict[str, Any]:
    data = json.loads(transcript.read_text(encoding="utf-8"))
    turns = data.get("turns") or []
    derived = derived_rows(turns)
    self_rows = load_self(self_path)
    merged = merge(derived, self_rows)
    return {
        "counts_derived": len(derived),
        "counts_self": len(self_rows),
        "derived": derived,
        "merged": merged,
        "self": self_rows,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--transcript", required=True)
    parser.add_argument("--self")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    out = score_transcript(Path(args.transcript), Path(args.self) if args.self else None)
    sys.stdout.write(json.dumps(out, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
