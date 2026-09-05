"""Headline branch, tie-break triggers, indistinguishability, budget.

Make targets: branch, indistinguishable, tiebreak, exhibit (budget).
Inputs: --evidence, --rubric (thresholds only from RUBRIC.md).
Outputs: evidence/branch.json, tiebreak-triggers.jsonl, indistinguishability.json.
Exit: 0 ok · 1 usage · 2 missing rubric.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from run.common import ARMS, EXIT_OK, EXIT_PRECONDITION, die, parse_float, utc_now, write_json
from score.spec_coverage import load_rubric_block
from score.scorecard import COLUMNS, MEAN_ROLES, mean_drop_null, read_scorecard, write_table


def thresholds(rubric: Path) -> dict[str, Any]:
    block = load_rubric_block(rubric, "thresholds")
    if not isinstance(block, dict):
        die(EXIT_PRECONDITION, "missing rubric:thresholds")
    return block


def arm_means(rows: list[dict[str, str]]) -> dict[str, float | None]:
    means: dict[str, float | None] = {}
    for arm in ARMS:
        vals = [
            r.get("coverage_f1p")
            for r in rows
            if r.get("arm") == arm and r.get("role") in MEAN_ROLES
        ]
        means[arm] = mean_drop_null(vals)
    return means


def arm_spread(rows: list[dict[str, str]], arm: str) -> float | None:
    vals = [
        parse_float(r.get("coverage_f1p"))
        for r in rows
        if r.get("arm") == arm and r.get("role") in MEAN_ROLES
    ]
    nums = [v for v in vals if v is not None]
    if len(nums) < 2:
        return None
    return round(max(nums) - min(nums), 1)


def partition(separation: float, thr: dict[str, Any]) -> str:
    b_upper = float(thr.get("separation_bands", {}).get("B_upper", 10))
    a_minus_upper = float(thr.get("separation_bands", {}).get("A_minus_upper", 20))
    if separation < b_upper:
        return "B"
    if separation < a_minus_upper:
        return "A-"
    return "A"


def compute_branch(rows: list[dict[str, str]], thr: dict[str, Any], *, budget_skipped: dict[str, Any] | None = None) -> dict[str, Any]:
    means = arm_means(rows)
    figured = {arm: m for arm, m in means.items() if m is not None}
    excluded = [arm for arm, m in means.items() if m is None]
    overlays: list[str] = []
    notes: list[str] = []
    if len(figured) < 2:
        separation = float(thr.get("separation_when_fewer_than_two_arms", 0))
        branch = str(thr.get("separation_zero_branch", "B"))
        if excluded:
            overlays.append("C")
            notes.append(f"excluded from separation: {', '.join(excluded)}")
    else:
        separation = round(max(figured.values()) - min(figured.values()), 1)
        branch = partition(separation, thr)
        if excluded:
            overlays.append("C")
            notes.append(f"excluded from separation: {', '.join(excluded)}")
    spreads = {arm: arm_spread(rows, arm) for arm in ARMS}
    spread_flag = str(thr.get("spread_not_computed_flag", "spread not computed: missing f1p"))
    for arm, sp in list(spreads.items()):
        if sp is None:
            notes.append(f"{arm}: {spread_flag}")
    observed = [s for s in spreads.values() if s is not None]
    largest = max(observed) if observed else 0.0
    if budget_skipped:
        width = float(thr.get("spread_trigger", 15))
        for arm, info in budget_skipped.items():
            if isinstance(info, dict) and info.get("run") is False:
                sp = spreads.get(arm)
                declared = parse_float(info.get("spread"))
                if declared is not None:
                    largest = max(largest, declared)
                elif sp is not None:
                    largest = max(largest, sp)
                largest = max(largest, width)
    a_minus_variant = None
    if branch == "A-":
        a_minus_variant = "i" if separation <= largest else "ii"
    # Overlay D: gatekit loses
    gk = means.get("gatekit")
    others = [m for a, m in figured.items() if a != "gatekit"]
    if gk is not None and others and gk < min(others):
        overlays.append("D")
    gk_fail = [
        r
        for r in rows
        if r.get("arm") == "gatekit"
        and r.get("role") in MEAN_ROLES
        and (str(r.get("f1_acceptance")).lower() == "fail" or str(r.get("f1p_acceptance")).lower() == "fail")
    ]
    if gk_fail:
        if "D" not in overlays:
            overlays.append("D")
    # Overlay E: mixed / disagreement
    for arm in ARMS:
        sp = spreads.get(arm)
        if sp is not None and sp > float(thr.get("spread_trigger", 15)):
            if "E" not in overlays:
                overlays.append("E")
        pf = [
            (r.get("f1_acceptance"), r.get("f1p_acceptance"))
            for r in rows
            if r.get("arm") == arm and r.get("role") in MEAN_ROLES
        ]
        if len({x for x in pf}) > 1 and len(pf) >= 2:
            if "E" not in overlays:
                overlays.append("E")
    return {
        "a_minus_variant": a_minus_variant,
        "branch": branch,
        "excluded_arms": excluded,
        "inputs": {"means": means, "separation": separation, "spreads": spreads},
        "largest_spread": largest,
        "notes": notes,
        "overlays": overlays,
        "separation": separation,
    }


def passfail_disagreement(rows: list[dict[str, str]], arm: str) -> bool:
    scored = [r for r in rows if r.get("arm") == arm and r.get("role") in MEAN_ROLES]
    if len(scored) < 2:
        return False
    marks = [(r.get("f1_acceptance"), r.get("f1p_acceptance")) for r in scored]
    return len(set(marks)) > 1


def tiebreak_triggers(rows: list[dict[str, str]], thr: dict[str, Any]) -> list[dict[str, Any]]:
    fired_at = utc_now()
    out = []
    width = float(thr.get("spread_trigger", 15))
    for arm in ARMS:
        spread = arm_spread(rows, arm)
        pf = passfail_disagreement(rows, arm)
        trigger = None
        if pf and spread is not None and spread > width:
            trigger = "both"
        elif pf:
            trigger = "passfail"
        elif spread is not None and spread > width:
            trigger = "spread"
        if trigger:
            out.append(
                {
                    "arm": arm,
                    "fired_at": fired_at,
                    "trigger": trigger,
                    "values": {"spread": spread},
                }
            )
    return out


def indistinguishable(rows: list[dict[str, str]], thr: dict[str, Any]) -> dict[str, Any]:
    all_pass = all(
        str(r.get("f1_acceptance")).lower() in {"pass", "true", "1"}
        and str(r.get("f1p_acceptance")).lower() in {"pass", "true", "1"}
        for r in rows
        if r.get("role") in MEAN_ROLES
    )
    means = arm_means(rows)
    figured = [m for m in means.values() if m is not None]
    sep = round(max(figured) - min(figured), 1) if len(figured) >= 2 else 0.0
    decisions = [
        parse_float(r.get("decisions_derived"))
        for r in rows
        if r.get("role") in MEAN_ROLES
    ]
    nums = [d for d in decisions if d is not None]
    within = (max(nums) - min(nums) <= 1) if nums else True
    files = {r.get("files_touched_f1p") for r in rows if r.get("role") in MEAN_ROLES}
    same_files = len(files) <= 1
    verdict = bool(all_pass and sep < 10 and within and same_files)
    return {
        "all_pass": all_pass,
        "conditions": {
            "all_pass_f1_f1p": all_pass,
            "decision_counts_within_1": within,
            "same_file_set": same_files,
            "separation_below_10": sep < 10,
        },
        "separation": sep,
        "verdict": verdict,
    }


def budget(spend_path: Path) -> str:
    if not spend_path.is_file():
        return "go"
    data = json.loads(spend_path.read_text(encoding="utf-8"))
    projected = float(data.get("projected_total") or data.get("total") or 0)
    return "go" if projected <= 600 else "park"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("cmd", choices=["indistinguishable", "tiebreak", "branch", "budget"])
    parser.add_argument("--evidence", default="../evidence")
    parser.add_argument("--rubric", default="score/RUBRIC.md")
    args = parser.parse_args(argv)
    evidence = Path(args.evidence)
    thr = thresholds(Path(args.rubric))
    csv_path = evidence / "trials" / "scorecard.csv"
    if not csv_path.is_file():
        write_table(evidence, evidence / "trials")
    rows = read_scorecard(evidence / "trials" / "scorecard.csv") if (evidence / "trials" / "scorecard.csv").is_file() else []
    if args.cmd == "branch":
        skipped = {}
        p = evidence / "tiebreak-decisions.json"
        if p.is_file():
            skipped = json.loads(p.read_text(encoding="utf-8"))
        payload = compute_branch(rows, thr, budget_skipped=skipped)
        write_json(evidence / "branch.json", payload)
    elif args.cmd == "tiebreak":
        trig = tiebreak_triggers(rows, thr)
        dest = evidence / "tiebreak-triggers.jsonl"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text("".join(json.dumps(t, sort_keys=True) + "\n" for t in trig), encoding="utf-8")
        print(dest)
    elif args.cmd == "indistinguishable":
        payload = indistinguishable(rows, thr)
        write_json(evidence / "indistinguishability.json", payload)
        print("indistinguishable" if payload["verdict"] else "distinguishable")
    else:
        print(budget(evidence / "spend.json"))
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
