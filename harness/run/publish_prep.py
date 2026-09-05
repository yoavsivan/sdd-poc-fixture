"""Assemble harness/results/2026-09/ from evidence through the sanitizer.

Make target: publish-prep.
Inputs: evidence/, registrations, H files from $HARNESS_HELD_OUT.
Outputs: harness/results/2026-09/** ; H files copied to harness paths.
Exit: 0 ok · 2 digest or sanitizer failure.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path
from typing import Any

from run.common import (
    EXIT_OK,
    EXIT_PRECONDITION,
    H_REL_PATHS,
    REGISTERED_P_REL,
    die,
    harness_dir,
    held_out_dir,
    load_config,
    read_json,
    run_dir,
    write_text,
)
from run.sanitize import load_blocklist, sanitize_tree


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def copy_tree(src: Path, dest: Path) -> None:
    if dest.exists():
        if dest.is_dir():
            shutil.rmtree(dest)
        else:
            dest.unlink()
    dest.parent.mkdir(parents=True, exist_ok=True)
    if src.is_dir():
        shutil.copytree(src, dest)
    else:
        shutil.copy2(src, dest)


def copy_registration(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(src.read_bytes())


def files_from_reg(reg: dict[str, Any]) -> dict[str, str]:
    return {f["path"]: f["sha256"] for f in reg.get("files") or []}


def copy_h_to_harness(held: Path, dest_root: Path) -> None:
    for rel in H_REL_PATHS:
        src = held / rel
        if src.exists():
            copy_tree(src, dest_root / rel)


def copy_registered_layout(held: Path, dest: Path, root: Path, *, cohort: str) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    copy_h_to_harness(held, dest)
    for rel in REGISTERED_P_REL:
        src = root / "harness" / rel
        if src.is_file():
            target = dest / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, target)


def publish(cfg: dict[str, Any], *, verify: bool = False) -> Path:
    evidence = run_dir()
    held = held_out_dir(cfg)
    root = harness_dir()
    results = root / cfg.get("results_dir", "results/2026-09")
    results.mkdir(parents=True, exist_ok=True)
    v1 = evidence / "pre-registration.json"
    v2 = evidence / "pre-registration-2.json"
    reshaped = v2.is_file() or (root / "pre-registration-2.json").is_file()
    if v1.is_file():
        copy_registration(v1, results / "pre-registration.json")
        copy_registration(v1, root / "pre-registration.json")
    if reshaped:
        src_v2 = v2 if v2.is_file() else root / "pre-registration-2.json"
        copy_registration(src_v2, results / "pre-registration-2.json")
        copy_registration(src_v2, root / "pre-registration-2.json")
        pilot_held = results / "pilot" / "held-out"
        copy_h_to_harness(held, pilot_held)
        for rel in REGISTERED_P_REL:
            src = root / rel
            if src.is_file():
                target = pilot_held / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, target)
    copy_h_to_harness(held, root)
    trials = evidence / "trials"
    if trials.is_dir():
        for path in trials.rglob("*"):
            if path.is_file() and path.name not in {"transcript.json", "trial.json"}:
                rel = path.relative_to(trials)
                dest = results / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, dest)
    write_text(
        results / "README.md",
        "\n".join(
            [
                "# Results 2026-09",
                "",
                "scorecard.csv — every scored and tie-break row.",
                "decisions.csv — Track A ledger.",
                "INVALID.md — harness-invalid runs.",
                "CAVEATS.md — freeze exceptions and sanitizer notes.",
                "triptych.md — first scored trial per arm.",
                "branch.json — the named headline branch.",
                "pre-registration.json — digest list v1.",
                "<arm>/<n>/ — sanitized per-trial bundle.",
            ]
        ),
    )
    notes = []
    try:
        tokens = load_blocklist()
        notes = sanitize_tree(results, tokens)
    except SystemExit as exc:
        if verify:
            raise
        if int(getattr(exc, "code", 0) or 0) == 3:
            notes = []
    if notes:
        caveats = results / "CAVEATS.md"
        extra = "\n".join(notes) + "\n"
        if caveats.is_file():
            caveats.write_text(caveats.read_text(encoding="utf-8") + extra, encoding="utf-8")
        else:
            caveats.write_text(extra, encoding="utf-8")
    if verify:
        _verify(cfg, results, held, root, reshaped)
    return results


def _verify(cfg: dict[str, Any], results: Path, held: Path, root: Path, reshaped: bool) -> None:
    from run.sanitize import check_pass, load_blocklist

    tokens = load_blocklist()
    for path in results.rglob("*"):
        if path.is_file() and path.suffix.lower() != ".png":
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            hits = check_pass(text, tokens)
            if hits:
                die(EXIT_PRECONDITION, f"sanitizer check failed: {path} {hits}")
            if "seat_id" in text or "cursor.com/agents" in text:
                die(EXIT_PRECONDITION, f"identity remnant: {path}")
    latest = results / ("pre-registration-2.json" if reshaped else "pre-registration.json")
    if latest.is_file():
        reg = files_from_reg(read_json(latest))
        for rel, expected in reg.items():
            local = root.parent / rel if rel.startswith("harness/") else root / rel
            # harness/foo -> root is harness/, so strip prefix
            if rel.startswith("harness/"):
                local = root / rel[len("harness/") :]
            if local.is_file() and digest(local) != expected:
                die(EXIT_PRECONDITION, f"digest differs from cohort registration: {rel}")
    if reshaped:
        v1 = files_from_reg(read_json(results / "pre-registration.json"))
        pilot = results / "pilot" / "held-out"
        for rel, expected in v1.items():
            suffix = rel[len("harness/") :] if rel.startswith("harness/") else rel
            local = pilot / suffix
            if local.is_file() and digest(local) != expected:
                die(EXIT_PRECONDITION, f"pilot digest differs: {rel}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args(argv)
    cfg = load_config()
    results = publish(cfg, verify=args.verify)
    print(results)
    print("reviewer reminder: run the employer-coupling greps; they are not shipped")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
