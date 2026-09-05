"""Validate stale.json (six questions) and write stale-count.txt.

Make target: score (stale/collect.py --trial DIR).
Inputs: trial/stale.json {questions:[{q:1..6, contradicted:[...]}], count}.
Outputs: stale-count.txt. Exit: 0 ok · 1 usage · 2 missing question / bad schema.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from run.common import EXIT_OK, EXIT_PRECONDITION, EXIT_USAGE, die, write_text


def validate(data: dict) -> int:
    questions = data.get("questions")
    if not isinstance(questions, list):
        die(EXIT_PRECONDITION, "stale.json missing questions")
    seen = set()
    total = 0
    for q in questions:
        n = q.get("q")
        if n not in range(1, 7):
            die(EXIT_PRECONDITION, "question number out of range")
        if n in seen:
            die(EXIT_PRECONDITION, "duplicate question")
        seen.add(n)
        contradicted = q.get("contradicted") or []
        total += len(contradicted)
    if seen != set(range(1, 7)):
        missing = set(range(1, 7)) - seen
        die(EXIT_PRECONDITION, f"missing question {sorted(missing)[0]}")
    count = int(data.get("count", total))
    if count != total:
        die(EXIT_PRECONDITION, "count does not equal contradicted statements")
    return count


def collect(trial: Path) -> int:
    path = trial / "stale.json"
    if not path.is_file():
        die(EXIT_PRECONDITION, f"missing {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    count = validate(data)
    write_text(trial / "stale-count.txt", str(count))
    return count


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--trial", required=True)
    args = parser.parse_args(argv)
    collect(Path(args.trial))
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
