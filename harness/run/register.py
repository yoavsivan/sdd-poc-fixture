"""Write and verify pre-registration digest lists.

Make targets: register, register-v2, verify-registration.
Inputs: H files from $HARNESS_HELD_OUT; P files from the working copy.
Outputs: evidence/pre-registration.json (+ harness copy); -2.json for --v2.
Exit: 0 ok · 1 usage · 2 verification failure.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import sys
from pathlib import Path
from typing import Any

from run.common import (
    EXIT_OK,
    EXIT_PRECONDITION,
    EXIT_USAGE,
    FIXTURE_SHA,
    FIXTURE_TAG,
    GATEKIT_SHA,
    GATEKIT_TAG,
    H_REL_PATHS,
    PINNED_MODEL,
    REGISTERED_P_REL,
    die,
    harness_dir,
    held_out_dir,
    load_config,
    read_json,
    repo_root,
    run_dir,
    utc_now,
    write_json,
)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def _h_source(held: Path, rel: str) -> Path:
    return held / rel


def list_h_files(held: Path) -> list[Path]:
    files: list[Path] = []
    for rel in H_REL_PATHS:
        src = _h_source(held, rel)
        if src.is_dir():
            for p in sorted(src.rglob("*")):
                if p.is_file():
                    files.append(p)
        elif src.is_file():
            files.append(src)
        else:
            die(EXIT_PRECONDITION, f"H path empty or missing: {rel}")
    if not files:
        die(EXIT_PRECONDITION, "H path empty")
    return files


def harness_path_for_h(held: Path, path: Path) -> str:
    rel = path.relative_to(held).as_posix()
    return f"harness/{rel}"


def collect_entries(held: Path, root: Path) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    for path in list_h_files(held):
        if path.stat().st_size == 0:
            die(EXIT_PRECONDITION, f"zero-byte file: {path}")
        entries.append({"path": harness_path_for_h(held, path), "sha256": sha256_file(path)})
    for rel in REGISTERED_P_REL:
        path = root / "harness" / rel
        if not path.is_file() or path.stat().st_size == 0:
            die(EXIT_PRECONDITION, f"missing or empty: harness/{rel}")
        entries.append({"path": f"harness/{rel}", "sha256": sha256_file(path)})
    entries.sort(key=lambda e: e["path"].encode("utf-8"))
    return entries


def tracked_h_paths(repo: Path) -> list[str]:
    import subprocess

    proc = subprocess.run(
        ["git", "ls-files", "harness"],
        cwd=str(repo),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        return []
    hits = []
    for line in proc.stdout.splitlines():
        for rel in H_REL_PATHS:
            prefix = f"harness/{rel}"
            if line == prefix or line.startswith(prefix + "/"):
                hits.append(line)
    return hits


def build_payload(held: Path, root: Path, *, registration: int, supersedes: dict[str, str] | None) -> dict[str, Any]:
    files = collect_entries(held, root)
    payload: dict[str, Any] = {
        "algorithm": "sha256",
        "count": len(files),
        "files": files,
        "fixture_tag": {"name": FIXTURE_TAG, "sha": FIXTURE_SHA},
        "gatekit_tag": {"name": GATEKIT_TAG, "sha": GATEKIT_SHA},
        "model": PINNED_MODEL,
        "registration": registration,
        "written_at": utc_now(),
    }
    if supersedes:
        payload["reason"] = (
            "the pre-declared indistinguishability test fired at the dry-run checkpoint"
        )
        payload["supersedes"] = supersedes
    return payload


def write_registration(payload: dict[str, Any], *, dest_name: str) -> tuple[Path, Path]:
    evidence = run_dir() / dest_name
    public = harness_dir() / dest_name
    write_json(evidence, payload)
    public.parent.mkdir(parents=True, exist_ok=True)
    public.write_text(evidence.read_text(encoding="utf-8"), encoding="utf-8")
    print(str(public.relative_to(repo_root())))
    return evidence, public


def verify_local(held: Path, root: Path, registration_path: Path) -> None:
    data = read_json(registration_path)
    expected = {f["path"]: f["sha256"] for f in data["files"]}
    actual_entries = collect_entries(held, root)
    actual = {f["path"]: f["sha256"] for f in actual_entries}
    if set(expected) != set(actual):
        die(EXIT_PRECONDITION, "registration path set mismatch")
    for path, digest in expected.items():
        if actual.get(path) != digest:
            die(EXIT_PRECONDITION, f"digest mismatch: {path}")
        print(f"OK  {digest}  {path}")


def verify_public(registration_path: Path, *, repo: Path | None = None) -> None:
    import subprocess

    repo = repo or repo_root()
    proc = subprocess.run(
        ["git", "show", "origin/main:harness/pre-registration.json"],
        cwd=str(repo),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        die(EXIT_PRECONDITION, "origin/main does not contain harness/pre-registration.json")
    local = registration_path.read_text(encoding="utf-8")
    if proc.stdout != local:
        die(EXIT_PRECONDITION, "public copy is not byte-identical")


def copy_h_to_held(held: Path, root: Path) -> None:
    """Ensure working-copy H files and held-out copies are identical."""
    import shutil

    wc_h = root / "harness"
    for rel in H_REL_PATHS:
        src = wc_h / rel
        dest = held / rel
        if not src.exists():
            continue
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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--v1", action="store_true")
    parser.add_argument("--v2", action="store_true")
    parser.add_argument("--verify-local", action="store_true")
    parser.add_argument("--verify-public", action="store_true")
    parser.add_argument("--verify-pilot", action="store_true")
    args = parser.parse_args(argv)
    cfg = load_config()
    held = held_out_dir(cfg)
    root = repo_root()
    # Write-time invariant: H must not be tracked at --v1/--v2. After the
    # results push, H is `git add -f`'d (design §9), so --verify-* must still run.
    if (args.v1 or args.v2) and tracked_h_paths(root):
        die(EXIT_PRECONDITION, "H file is tracked in git ls-files")
    if args.v1 or args.v2:
        copy_h_to_held(held, root)
        if args.v2:
            v1 = run_dir() / "pre-registration.json"
            if not v1.is_file():
                die(EXIT_PRECONDITION, "v1 registration missing")
            payload = build_payload(
                held,
                root,
                registration=2,
                supersedes={
                    "path": "harness/pre-registration.json",
                    "sha256": sha256_file(v1),
                },
            )
            write_registration(payload, dest_name="pre-registration-2.json")
        else:
            payload = build_payload(held, root, registration=1, supersedes=None)
            write_registration(payload, dest_name="pre-registration.json")
        return EXIT_OK
    if args.verify_local:
        path = run_dir() / "pre-registration.json"
        if os.environ.get("HARNESS_VERIFY_V2") == "1" or (harness_dir() / "pre-registration-2.json").is_file():
            v2 = run_dir() / "pre-registration-2.json"
            if v2.is_file():
                path = v2
        verify_local(held, root, path)
        print(f"registration v{read_json(path)['registration']}: {read_json(path)['count']}/{read_json(path)['count']} digests match (local)")
    if args.verify_public:
        verify_public(run_dir() / "pre-registration.json")
        print("registration v1: public copy matches")
    if args.verify_pilot:
        die(EXIT_USAGE, "verify-pilot expects results/2026-09/pilot/held-out after publish-prep")
    if not (args.v1 or args.v2 or args.verify_local or args.verify_public):
        die(EXIT_USAGE, "specify --v1, --v2, or --verify-local/--verify-public")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
