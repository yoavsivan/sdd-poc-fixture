"""Scorecard, ledger, invalid index, caveats, triptych.

Make targets: scorecard, triptych.
Inputs: --evidence, --out; scorecard.csv columns are frozen (design §3.6).
Outputs: scorecard.csv, decisions.csv, INVALID.md, CAVEATS.md, triptych.md.
Exit: 0 ok · 1 usage · 2 missing evidence.
"""
from __future__ import annotations

import argparse
import csv
import json
import statistics
import sys
from pathlib import Path
from typing import Any

from run.common import ARMS, EXIT_OK, EXIT_USAGE, die, parse_float, write_text

COLUMNS = [
    "arm",
    "trial",
    "cohort",
    "role",
    "model",
    "spawned_at",
    "finished_at",
    "seat_minutes",
    "messages",
    "f1_acceptance",
    "f1_passed_of_5",
    "f1p_acceptance",
    "f1p_passed_of_3",
    "smoke_f1_of_4",
    "smoke_f1p_of_4",
    "coverage_f1",
    "coverage_f1p",
    "coverage_drop",
    "spec_layout_review",
    "decisions_self",
    "decisions_derived",
    "stale_statements",
    "diff_lines_f1p",
    "files_touched_f1p",
    "review_burden_lines",
    "legacy_session_modified",
    "tie_break_trigger",
    "invalid_reason",
]

MEAN_ROLES = {"scored", "tie-break"}


def empty_row() -> dict[str, Any]:
    return {k: "" for k in COLUMNS}


def coverage_drop(f1: Any, f1p: Any) -> Any:
    a, b = parse_float(f1), parse_float(f1p)
    if a is None or b is None:
        return ""
    return round(a - b, 1)


def load_trial_row(trial_dir: Path) -> dict[str, Any]:
    row = empty_row()
    trial = {}
    tj = trial_dir / "trial.json"
    if tj.is_file():
        trial = json.loads(tj.read_text(encoding="utf-8"))
    row["arm"] = trial.get("arm") or trial_dir.parent.name
    row["trial"] = trial.get("trial") or trial_dir.name
    row["cohort"] = trial.get("cohort") or "v1"
    row["role"] = trial.get("role") or "scored"
    row["model"] = trial.get("model") or ""
    row["spawned_at"] = trial.get("spawned_at") or ""
    row["finished_at"] = trial.get("finished_at") or ""
    row["messages"] = trial.get("messages") if trial.get("messages") is not None else ""
    spawned, finished = trial.get("spawned_at"), trial.get("finished_at")
    if spawned and finished:
        from datetime import datetime

        def pz(s: str) -> datetime:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))

        try:
            row["seat_minutes"] = round((pz(finished) - pz(spawned)).total_seconds() / 60.0, 1)
        except Exception:
            row["seat_minutes"] = ""
    score = {}
    sj = trial_dir / "score.json"
    if sj.is_file():
        score = json.loads(sj.read_text(encoding="utf-8"))
    for key in COLUMNS:
        if key in score and score[key] not in (None,):
            row[key] = score[key]
    for label, key in (("f1", "coverage_f1"), ("f1p", "coverage_f1p")):
        cov = trial_dir / f"coverage-{label}.json"
        if cov.is_file():
            data = json.loads(cov.read_text(encoding="utf-8"))
            row[key] = data.get("pct") if data.get("pct") is not None else ""
            if data.get("total") == 0 and data.get("pct") is None:
                flags = list(trial.get("flags") or [])
                flags.append("no-surface")
                trial["flags"] = flags
    tags = {}
    if (trial_dir / "tags.json").is_file():
        tags = json.loads((trial_dir / "tags.json").read_text(encoding="utf-8"))
    if not tags.get("done-f1p") and row["coverage_f1p"] == "":
        flags = list(trial.get("flags") or [])
        if "missing-done-f1p" not in flags:
            flags.append("missing-done-f1p")
        trial["flags"] = flags
    row["coverage_drop"] = coverage_drop(row.get("coverage_f1"), row.get("coverage_f1p"))
    row["spec_layout_review"] = "true" if "spec-layout-review" in (trial.get("flags") or []) else "false"
    derived = trial_dir / "decisions-derived.json"
    if derived.is_file():
        d = json.loads(derived.read_text(encoding="utf-8"))
        row["decisions_self"] = d.get("counts_self", "")
        row["decisions_derived"] = d.get("counts_derived", "")
    stale = trial_dir / "stale-count.txt"
    if stale.is_file():
        row["stale_statements"] = stale.read_text(encoding="utf-8").strip()
    diff = trial_dir / "diff-f1p.patch"
    if diff.is_file():
        text = diff.read_text(encoding="utf-8")
        row["diff_lines_f1p"] = str(sum(1 for ln in text.splitlines() if ln.startswith("+") or ln.startswith("-")))
        files = {ln[6:] for ln in text.splitlines() if ln.startswith("+++ b/")}
        row["files_touched_f1p"] = str(len(files))
        row["legacy_session_modified"] = "true" if "src/legacy/session.cjs" in text else "false"
        row["review_burden_lines"] = row["diff_lines_f1p"]
    row["tie_break_trigger"] = trial.get("tie_break_trigger") or "none"
    row["invalid_reason"] = trial.get("invalid_reason") or ""
    if trial.get("invalid_reason"):
        row["role"] = "invalid"
    return row


def iter_trial_dirs(evidence: Path) -> list[Path]:
    trials = evidence / "trials"
    found: list[Path] = []
    if not trials.is_dir():
        return found
    for arm in ARMS:
        arm_dir = trials / arm
        if not arm_dir.is_dir():
            continue
        for child in sorted(arm_dir.iterdir(), key=lambda p: p.name):
            if child.is_dir() and (child / "trial.json").is_file():
                found.append(child)
    return found


def mean_drop_null(values: list[Any]) -> float | None:
    nums = [v for v in (parse_float(x) for x in values) if v is not None]
    if not nums:
        return None
    return round(sum(nums) / len(nums), 1)


def write_table(evidence: Path, out: Path, extra_rows: list[dict[str, Any]] | None = None) -> Path:
    rows = [load_trial_row(p) for p in iter_trial_dirs(evidence)]
    if extra_rows:
        rows.extend(extra_rows)
    budget = evidence / "tiebreak-decisions.json"
    if budget.is_file():
        data = json.loads(budget.read_text(encoding="utf-8"))
        for arm, info in data.items():
            if isinstance(info, dict) and info.get("run") is False and info.get("reason") == "budget":
                r = empty_row()
                r.update(
                    {
                        "arm": arm,
                        "trial": 3,
                        "cohort": "v1",
                        "role": "tie-break not run: budget",
                        "tie_break_trigger": info.get("trigger") or "spread",
                    }
                )
                rows.append(r)
    scored = [r for r in rows if r.get("role") in MEAN_ROLES]
    pilots = [r for r in rows if r.get("role") == "pilot"]
    invalids = [r for r in rows if r.get("role") == "invalid"]
    budget_rows = [r for r in rows if r.get("role") == "tie-break not run: budget"]
    scored.sort(key=lambda r: (str(r.get("arm")), int(r.get("trial") or 0) if str(r.get("trial")).isdigit() else 0))
    dest = out / "scorecard.csv"
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(COLUMNS)
        for r in scored + budget_rows:
            w.writerow([r.get(c, "") if r.get(c, "") is not None else "" for c in COLUMNS])
        if pilots:
            w.writerow([])
            w.writerow(["# pilot (reshaped brief; never in a mean)"] + [""] * (len(COLUMNS) - 1))
            for r in pilots:
                w.writerow([r.get(c, "") if r.get(c, "") is not None else "" for c in COLUMNS])
    print(dest)
    return dest


def write_ledger(evidence: Path, out: Path) -> Path:
    dest = out / "decisions.csv"
    dest.parent.mkdir(parents=True, exist_ok=True)
    header = ["arm", "trial", "cohort", "role", "type", "source", "seat_turn", "question_excerpt", "answer_excerpt"]
    rows: list[list[Any]] = []
    for tdir in iter_trial_dirs(evidence):
        trial = json.loads((tdir / "trial.json").read_text(encoding="utf-8"))
        if trial.get("invalid_reason") or trial.get("role") == "invalid":
            continue
        derived = tdir / "decisions-derived.json"
        if not derived.is_file():
            continue
        data = json.loads(derived.read_text(encoding="utf-8"))
        for m in data.get("merged") or []:
            rows.append(
                [
                    trial.get("arm"),
                    trial.get("trial"),
                    trial.get("cohort"),
                    trial.get("role"),
                    m.get("type"),
                    m.get("source"),
                    m.get("turn"),
                    (m.get("question") or m.get("excerpt") or "")[:200],
                    (m.get("answer") or "")[:200],
                ]
            )
    with dest.open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)
    print(dest)
    return dest


def write_invalid(evidence: Path, out: Path) -> Path:
    lines = ["# INVALID", "", "| arm | n | spawned_at | reason | seat_minutes | rerun-of |", "|---|---|---|---|---|---|"]
    for tdir in iter_trial_dirs(evidence):
        trial = json.loads((tdir / "trial.json").read_text(encoding="utf-8"))
        if not trial.get("invalid_reason") and trial.get("role") != "invalid":
            continue
        lines.append(
            f"| {trial.get('arm')} | {trial.get('trial')} | {trial.get('spawned_at')} | {trial.get('invalid_reason')} |  |  |"
        )
    dest = out / "INVALID.md"
    write_text(dest, "\n".join(lines) + "\n")
    return dest


def write_caveats(evidence: Path, out: Path) -> Path:
    parts = ["# CAVEATS", ""]
    freeze = evidence / "freeze-exceptions.jsonl"
    if freeze.is_file():
        for line in freeze.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            parts.append(
                f"- freeze exception ({row.get('kind')}): {row.get('sha')} {row.get('utc')} trials={row.get('trials_spawned')} {row.get('reason')}"
            )
    else:
        parts.append("- freeze exceptions: none")
    dest = out / "CAVEATS.md"
    write_text(dest, "\n".join(parts) + "\n")
    return dest


def write_triptych(evidence: Path, out: Path) -> Path:
    lines = ["# Rotate-keys triptych", "", "First scored trial per arm (alphabetical).", ""]
    for arm in ARMS:
        arm_dir = evidence / "trials" / arm
        if not arm_dir.is_dir():
            continue
        chosen = None
        for child in sorted(arm_dir.iterdir(), key=lambda p: p.name):
            if not (child / "trial.json").is_file():
                continue
            trial = json.loads((child / "trial.json").read_text(encoding="utf-8"))
            if trial.get("role") == "scored":
                chosen = child
                break
        if not chosen:
            continue
        lines.append(f"## {arm}")
        cov1 = chosen / "coverage-f1.json"
        cov2 = chosen / "coverage-f1p.json"
        acc = chosen / "acceptance-done-f1p.txt"
        if not acc.is_file():
            acc = chosen / "acceptance-f1p.txt"
        lines.append(f"coverage f1: {json.loads(cov1.read_text()).get('pct') if cov1.is_file() else 'n/a'}")
        lines.append(f"coverage f1p: {json.loads(cov2.read_text()).get('pct') if cov2.is_file() else 'n/a'}")
        lines.append(f"F1' acceptance: {'pass' if acc.is_file() and 'passed' in acc.read_text().lower() else 'see evidence'}")
        lines.append("")
    dest = out / "triptych.md"
    write_text(dest, "\n".join(lines) + "\n")
    return dest


def read_scorecard(path: Path) -> list[dict[str, str]]:
    rows = []
    with path.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            if not row.get("arm") or str(row.get("arm", "")).startswith("#"):
                continue
            rows.append(row)
    return rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("cmd", choices=["table", "ledger", "invalid", "caveats", "triptych"])
    parser.add_argument("--evidence", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args(argv)
    evidence = Path(args.evidence)
    out = Path(args.out)
    if args.cmd == "table":
        write_table(evidence, out)
    elif args.cmd == "ledger":
        write_ledger(evidence, out)
    elif args.cmd == "invalid":
        write_invalid(evidence, out)
    elif args.cmd == "caveats":
        write_caveats(evidence, out)
    else:
        write_triptych(evidence, out)
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
