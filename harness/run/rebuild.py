"""Rebuild a tagged SHA in the fixture's Docker containers and run smoke + acceptance.

Make target: called by trial.py; --acceptance-only is a generic rebuild option.
Inputs: SHA, arm, n, tag name, $HARNESS_HELD_OUT/acceptance, compose overlay.
Outputs: smoke-<tag>.txt, acceptance-<tag>.txt, acceptance-<tag>.json under the trial dir.
Exit: 0 ok · 1 usage · 2 missing sha · 3 docker.
Never runs the seat's working tree; never runs Node on the host.
"""
from __future__ import annotations

import argparse
import os
import shlex
import sys
from pathlib import Path
from typing import Any

from run.common import (
    EXIT_ENVIRONMENT,
    EXIT_OK,
    EXIT_PRECONDITION,
    EXIT_USAGE,
    die,
    harness_dir,
    held_out_dir,
    load_config,
    repo_root,
    run_dir,
    sh,
    write_text,
)


def project_name(arm: str, n: int | str, tag: str) -> str:
    return f"harness-{arm}-{n}-{tag}"


def worktree_path(arm: str, n: int | str, tag: str, evidence: Path) -> Path:
    return evidence / "build" / f"{arm}-{n}-{tag}"


def compose_cmd(
    arm: str,
    n: int | str,
    tag: str,
    worktree: Path,
    held_out: Path,
    *,
    overlay: Path | None = None,
    acceptance_only: bool = False,
) -> list[str]:
    overlay = overlay or (harness_dir() / "run" / "compose.acceptance.yml")
    project = project_name(arm, n, tag)
    compose_file = worktree / "docker-compose.yml"
    env = {
        "HARNESS_HELD_OUT": str(held_out),
        "PLAYWRIGHT_JSON_OUTPUT_NAME": str(
            worktree / f"acceptance-{tag}.json"
        ),
    }
    prefix = [
        "docker",
        "compose",
        "-p",
        project,
        "--profile",
        "acceptance",
        "-f",
        str(compose_file),
        "-f",
        str(overlay),
    ]
    up = prefix + ["up", "--build", "--abort-on-container-exit", "--exit-code-from", "playwright"]
    down = prefix + ["down", "-v"]
    return up + ["&&"] + down


def composed_command_string(
    arm: str,
    n: int | str,
    tag: str,
    worktree: Path,
    held_out: Path,
    sha: str,
) -> str:
    wt = f"git worktree add {worktree} {sha}"
    cmd = compose_cmd(arm, n, tag, worktree, held_out)
    body = " ".join(shlex.quote(c) if c != "&&" else "&&" for c in cmd)
    mount = f"{held_out}/acceptance:/work/.heldout/acceptance:ro"
    return f"{wt} && {body} # mount {mount} from $HARNESS_HELD_OUT"


def ensure_heldout_gitignore(worktree: Path) -> None:
    gi = worktree / ".gitignore"
    text = gi.read_text(encoding="utf-8") if gi.is_file() else ""
    if ".heldout/" not in text:
        with gi.open("a", encoding="utf-8") as fh:
            fh.write("\n.heldout/\n")


def rebuild(
    arm: str,
    n: int | str,
    sha: str,
    tag: str,
    cfg: dict[str, Any],
    *,
    acceptance_only: bool = False,
    execute: bool = True,
) -> dict[str, Any]:
    if not sha:
        die(EXIT_PRECONDITION, "missing sha")
    evidence = run_dir()
    held = held_out_dir(cfg)
    worktree = worktree_path(arm, n, tag, evidence)
    repo = repo_root()
    if worktree.exists():
        sh(["git", "worktree", "remove", "--force", str(worktree)], cwd=repo, check=False)
    worktree.parent.mkdir(parents=True, exist_ok=True)
    add = sh(["git", "worktree", "add", "--detach", str(worktree), sha], cwd=repo, check=False)
    if add.returncode != 0:
        die(EXIT_PRECONDITION, f"git worktree add failed for {sha}")
    ensure_heldout_gitignore(worktree)
    overlay = harness_dir() / "run" / "compose.acceptance.yml"
    cmd = compose_cmd(arm, n, tag, worktree, held, overlay=overlay, acceptance_only=acceptance_only)
    string = composed_command_string(arm, n, tag, worktree, held, sha)
    dest = evidence / "trials" / arm / str(n)
    dest.mkdir(parents=True, exist_ok=True)
    if not execute:
        return {"cmd": cmd, "string": string, "worktree": str(worktree)}
    env = dict(**{k: v for k, v in __import__("os").environ.items()})
    env["HARNESS_HELD_OUT"] = str(held)
    env["PLAYWRIGHT_JSON_OUTPUT_NAME"] = f"/work/acceptance-{tag}.json"
    if not acceptance_only:
        smoke = sh(
            [
                "docker",
                "compose",
                "-p",
                project_name(arm, n, tag),
                "-f",
                str(worktree / "docker-compose.yml"),
                "--profile",
                "smoke",
                "up",
                "--build",
                "--abort-on-container-exit",
                "--exit-code-from",
                "playwright",
            ],
            cwd=worktree,
            check=False,
            env=env,
        )
        write_text(dest / f"smoke-{tag}.txt", (smoke.stdout or "") + (smoke.stderr or ""))
    acc = sh(
        [c for c in cmd if c != "&&"][: cmd.index("&&")] if "&&" in cmd else cmd,
        cwd=worktree,
        check=False,
        env=env,
    )
    write_text(dest / f"acceptance-{tag}.txt", (acc.stdout or "") + (acc.stderr or ""))
    sh(
        [
            "docker",
            "compose",
            "-p",
            project_name(arm, n, tag),
            "-f",
            str(worktree / "docker-compose.yml"),
            "-f",
            str(overlay),
            "down",
            "-v",
        ],
        cwd=worktree,
        check=False,
        env=env,
    )
    return {"cmd": cmd, "string": string}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--arm", default="conductor")
    parser.add_argument("--n", default="1")
    parser.add_argument("--sha", required=True)
    parser.add_argument("--tag", default="done-f1")
    parser.add_argument("--acceptance-only", action="store_true")
    parser.add_argument("--print-cmd", action="store_true")
    args = parser.parse_args(argv)
    cfg = load_config()
    result = rebuild(
        args.arm,
        args.n,
        args.sha,
        args.tag,
        cfg,
        acceptance_only=args.acceptance_only,
        execute=not args.print_cmd,
    )
    if args.print_cmd:
        print(result["string"])
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
