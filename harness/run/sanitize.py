"""Publish sanitizer. Loads employer tokens from $HARNESS_BLOCKLIST (exit 3 if absent).

Make target: called by publish_prep.py and excerpts.py.
Inputs: text or a directory tree; $HARNESS_BLOCKLIST (default $HARNESS_RUN_DIR/blocklist.txt).
Outputs: sanitized text; CAVEATS.md replacement notes via returned log.
Exit: 0 ok · 2 a forbidden pattern survives · 3 blocklist missing.

S1–S8 are compiled here. Token literals for S7 never appear in this file.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Iterable

from run.common import (
    EXIT_ENVIRONMENT,
    EXIT_OK,
    EXIT_PRECONDITION,
    blocklist_path,
    run_dir,
)

S1 = re.compile(r"https?://(www\.)?cursor\.com/agents/[^\s)\]]+|https?://[^\s)\]]*\/agents\/bc-[^\s)\]]+", re.I)
S2 = re.compile(r"\bbc-[0-9a-f]{6,}[0-9a-f-]*\b", re.I)
S3 = re.compile(r"/Users/[^\s\"'`]+|/home/[^\s\"'`]+|/tmp/pubrun/[^\s\"'`]+|/agent/repos/[^\s\"'`]+|/private/var/[^\s\"'`]+")
S4 = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
S5 = re.compile(r"(?i)^\s*(cursor[-_ ]?account|account|org(anization)?[-_ ]?id|team[-_ ]?id|user[-_ ]?id|owner)\s*[:=].*$", re.M)
S6 = re.compile(r"\b(sk|xai|ghp|gho|github_pat|key)[-_][A-Za-z0-9_-]{16,}\b|Bearer [A-Za-z0-9._-]{16,}|\b[A-Z0-9_]*_API_KEY=")

BINARY_OK = {".png"}


def load_blocklist(path: Path | None = None) -> list[str]:
    p = path or blocklist_path()
    if not p.is_file():
        sys.stderr.write(f"blocklist missing: {p}\n")
        raise SystemExit(EXIT_ENVIRONMENT)
    tokens = []
    for line in p.read_text(encoding="utf-8").splitlines():
        t = line.strip()
        if t and not t.startswith("#"):
            tokens.append(t)
    return tokens


def apply_s1_s8(text: str, tokens: list[str], extra: list[str] | None = None) -> tuple[str, int]:
    n = 0
    out, c = S1.subn("<run-url removed>", text)
    n += c
    out, c = S2.subn("<seat-id removed>", out)
    n += c
    out, c = S3.subn("<path removed>", out)
    n += c
    out, c = S4.subn("<email removed>", out)
    n += c
    out, c = S5.subn("", out)
    n += c
    out, c = S6.subn("<secret removed>", out)
    n += c
    for token in tokens:
        if not token:
            continue
        count = out.lower().count(token.lower())
        if count:
            pattern = re.compile(re.escape(token), re.I)
            out, c = pattern.subn("<removed>", out)
            n += c
    extra = extra or []
    for token in extra:
        if token and token in out:
            out = out.replace(token, "<seat-id removed>")
            n += 1
    adapter = os.environ.get("HARNESS_SPAWN_ADAPTER")
    if adapter and adapter in out:
        out = out.replace(adapter, "<adapter removed>")
        n += 1
    return out, n


def check_pass(text: str, tokens: list[str], extra: list[str] | None = None) -> list[str]:
    hits: list[str] = []
    if S1.search(text) or "cursor.com/agents" in text:
        hits.append("S1")
    if S2.search(text):
        hits.append("S2")
    if S3.search(text):
        hits.append("S3")
    if S4.search(text):
        hits.append("S4")
    if S5.search(text):
        hits.append("S5")
    if S6.search(text):
        hits.append("S6")
    lowered = text.lower()
    for token in tokens:
        if token.lower() in lowered:
            hits.append("S7")
            break
    if "seat_id" in text:
        hits.append("seat_id")
    extra = extra or []
    for token in extra:
        if token and token in text:
            hits.append("extra")
    return hits


def sanitize_text(text: str, tokens: list[str] | None = None, extra: list[str] | None = None) -> tuple[str, int]:
    tokens = tokens if tokens is not None else load_blocklist()
    out, n = apply_s1_s8(text, tokens, extra=extra)
    hits = check_pass(out, tokens, extra=extra)
    if hits:
        sys.stderr.write(f"forbidden pattern survives: {hits}\n")
        raise SystemExit(EXIT_PRECONDITION)
    return out, n


def sanitize_tree(root: Path, tokens: list[str] | None = None, extra: list[str] | None = None) -> list[str]:
    tokens = tokens if tokens is not None else load_blocklist()
    notes: list[str] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() in BINARY_OK:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        out, n = sanitize_text(text, tokens, extra=extra)
        if out != text:
            path.write_text(out, encoding="utf-8")
        if n:
            notes.append(f"sanitizer replaced {n} tokens in {path.name}")
    return notes


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--in-place", action="store_true")
    args = parser.parse_args(argv)
    target = Path(args.path)
    tokens = load_blocklist()
    if target.is_dir():
        if args.check:
            for path in sorted(target.rglob("*")):
                if path.is_file() and path.suffix.lower() not in BINARY_OK:
                    try:
                        text = path.read_text(encoding="utf-8")
                    except UnicodeDecodeError:
                        continue
                    hits = check_pass(text, tokens)
                    if hits:
                        sys.stderr.write(f"{path}:{hits}\n")
                        return EXIT_PRECONDITION
            return EXIT_OK
        notes = sanitize_tree(target, tokens)
        for note in notes:
            print(note)
        return EXIT_OK
    text = target.read_text(encoding="utf-8")
    out, n = sanitize_text(text, tokens)
    if args.in_place:
        target.write_text(out, encoding="utf-8")
    else:
        sys.stdout.write(out)
    print(f"replaced {n}", file=sys.stderr)
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
