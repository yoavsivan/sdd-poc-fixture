"""Reshape bookkeeping: relabel dry trials as pilot and rename refs.

Make target: reshape.
Inputs: evidence/pre-registration-2.json (required), evidence/trials/<arm>/1.
Outputs: moved evidence, evidence/reshape.json, ref-rename plan.
Exit: 0 ok · 2 missing v2 registration.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import Any

from run.common import (
    ARMS,
    EXIT_OK,
    EXIT_PRECONDITION,
    die,
    run_dir,
    utc_now,
    write_json,
)


def ref_rename_plan() -> list[dict[str, str]]:
    plan = []
    for arm in ARMS:
        plan.append(
            {
                "arm": arm,
                "from_branch": f"trial/{arm}/1",
                "to_branch": f"pilot/{arm}/1",
                "from_tag_f1": f"trial/{arm}/1/done-f1",
                "to_tag_f1": f"pilot/{arm}/1/done-f1",
                "from_tag_f1p": f"trial/{arm}/1/done-f1p",
                "to_tag_f1p": f"pilot/{arm}/1/done-f1p",
            }
        )
    return plan


def reshape(evidence: Path | None = None) -> dict[str, Any]:
    evidence = evidence or run_dir()
    v2 = evidence / "pre-registration-2.json"
    public_v2 = Path(__file__).resolve().parent.parent / "pre-registration-2.json"
    if not v2.is_file() and not public_v2.is_file():
        die(EXIT_PRECONDITION, "refuses without pre-registration-2.json")
    moved: list[str] = []
    for arm in ARMS:
        src = evidence / "trials" / arm / "1"
        dest = evidence / "trials" / "pilot" / arm / "1"
        if src.is_dir():
            dest.parent.mkdir(parents=True, exist_ok=True)
            if dest.exists():
                shutil.rmtree(dest)
            shutil.move(str(src), str(dest))
            trial_json = dest / "trial.json"
            if trial_json.is_file():
                data = json.loads(trial_json.read_text(encoding="utf-8"))
                data["role"] = "pilot"
                trial_json.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            moved.append(f"trials/{arm}/1 -> trials/pilot/{arm}/1")
    payload = {
        "moved": moved,
        "reason": "pre-declared indistinguishability test fired at the dry-run checkpoint",
        "refs": ref_rename_plan(),
        "utc": utc_now(),
    }
    write_json(evidence / "reshape.json", payload)
    return payload


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.parse_args(argv)
    reshape()
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
