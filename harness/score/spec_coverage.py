"""Primary-metric instrument: extract shipped surface from a diff and match the spec.

Make target: score (via spec_coverage.py --json).
Inputs: --repo worktree, --base fixture SHA, --tag SHA, --arm, --rubric RUBRIC.md.
Outputs: JSON {arm, tag, spec_files, items, matched, total, pct, ...}.
Exit: 0 ok · 1 usage · 2 synonym not in briefs / bad RUBRIC.
Shares nothing with any arm's own drift tool.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

from run.common import EXIT_OK, EXIT_PRECONDITION, EXIT_USAGE, die, harness_dir

ROUTE_RE = re.compile(
    r"""\b(router|app|api|r)\.(get|post|put|patch|delete|all)\(\s*["'`]([^"'`]+)""",
    re.I,
)
TESTID_RE = re.compile(r'data-testid="([^"]+)"')
ARIA_RE = re.compile(r'aria-label="([^"]+)"')
BUTTON_RE = re.compile(r"<button\b[^>]*>([^<]+)</button>", re.I)
LABEL_RE = re.compile(r"<label\b[^>]*>([^<]+)</label>", re.I)
FENCE_RE = re.compile(r"```json rubric:(\w+)\s*\n(.*?)```", re.S)


def load_rubric_block(rubric: Path, name: str) -> Any:
    text = rubric.read_text(encoding="utf-8")
    for match in FENCE_RE.finditer(text):
        if match.group(1) == name:
            return json.loads(match.group(2))
    return None


def _collapse(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def _briefs_text(root: Path) -> str:
    parts = []
    for name in ("F1.md", "F1-prime.md"):
        path = root / "features" / name
        if path.is_file():
            parts.append(path.read_text(encoding="utf-8"))
    return _collapse("\n".join(parts))


def generate_variants(phrase: str) -> set[str]:
    raw = phrase.strip()
    forms = {raw, raw.lower()}
    spaced = re.sub(r"[-_]+", " ", raw)
    forms.add(spaced)
    forms.add(spaced.lower())
    camel = "".join(p.capitalize() if i else p for i, p in enumerate(re.split(r"[-_\s]+", raw) if False else re.split(r"[-_\s]+", raw)))
    # word form: hyphen/underscore/camel → spaces
    no_camel = re.sub(r"([a-z])([A-Z])", r"\1 \2", raw)
    forms.add(no_camel.lower())
    forms.add(re.sub(r"[-_]+", " ", no_camel).lower())
    # camelCase join
    words = re.split(r"[-_\s]+", raw)
    if words:
        camel = words[0] + "".join(w.capitalize() for w in words[1:])
        forms.add(camel)
        forms.add(camel.lower())
    # singular/plural on last token
    tokens = re.split(r"\s+", re.sub(r"[-_]+", " ", raw.lower()))
    if tokens:
        last = tokens[-1]
        alts = {last}
        if last.endswith("s") and len(last) > 1:
            alts.add(last[:-1])
        else:
            alts.add(last + "s")
        for alt in alts:
            forms.add(" ".join(tokens[:-1] + [alt]).strip())
            forms.add("-".join(tokens[:-1] + [alt]).strip())
    return {f for f in forms if f}


def validate_synonyms(synonyms: dict[str, list[str]], briefs: str) -> None:
    for key, phrases in synonyms.items():
        if key.startswith("GET ") or key.startswith("POST ") or key.startswith("/"):
            die(EXIT_PRECONDITION, "synonym key for a route")
        if key.lower() not in briefs and key not in briefs:
            # identifier must appear literally in a brief
            if key.lower() not in briefs:
                die(EXIT_PRECONDITION, f"synonym key not in briefs: {key}")
        for phrase in phrases:
            if _collapse(phrase) not in briefs:
                die(EXIT_PRECONDITION, f"synonym not in briefs: {phrase}")
            # reject hand-written plural/hyphen variant when canonical is present
            canon = phrase
            for other in phrases:
                if other == phrase:
                    continue
                variants = generate_variants(other)
                if phrase.lower() != other.lower() and phrase.lower() in {v.lower() for v in variants}:
                    die(EXIT_PRECONDITION, f"hand-written variant: {phrase}")


def load_config_from_rubric(rubric: Path, root: Path | None = None) -> dict[str, Any]:
    globs = load_rubric_block(rubric, "globs") or {}
    mounts = load_rubric_block(rubric, "mounts") or {}
    excludes = load_rubric_block(rubric, "excludes") or []
    synonyms = load_rubric_block(rubric, "synonyms") or {}
    thresholds = load_rubric_block(rubric, "thresholds") or {}
    root = root or harness_dir()
    briefs = _briefs_text(root)
    if isinstance(synonyms, dict) and briefs:
        validate_synonyms(synonyms, briefs)
    return {
        "excludes": excludes,
        "globs": globs,
        "mounts": mounts,
        "synonyms": synonyms,
        "thresholds": thresholds,
    }


def git_diff(repo: Path, base: str, tag: str, excludes: list[str]) -> str:
    pathspecs = [".", *[f":!{e}" for e in excludes]]
    proc = subprocess.run(
        ["git", "diff", "--unified=0", "--no-color", base, tag, "--", *pathspecs],
        cwd=str(repo),
        capture_output=True,
        text=True,
        check=False,
    )
    return proc.stdout


def added_lines_by_file(diff: str) -> dict[str, list[tuple[int, str]]]:
    files: dict[str, list[tuple[int, str]]] = {}
    current = None
    line_no = 0
    for line in diff.splitlines():
        if line.startswith("+++ b/"):
            current = line[6:]
            files.setdefault(current, [])
            line_no = 0
            continue
        if line.startswith("@@"):
            m = re.search(r"\+(\d+)", line)
            line_no = int(m.group(1)) if m else 0
            continue
        if current is None:
            continue
        if line.startswith("+") and not line.startswith("+++"):
            files.setdefault(current, []).append((line_no, line[1:]))
            line_no += 1
        elif line.startswith("-") and not line.startswith("---"):
            continue
        else:
            line_no += 1
    return files


def mount_prefix(path: str, mounts: dict[str, str]) -> str:
    for file, prefix in mounts.items():
        if path.endswith(file) or path == file:
            return prefix
    return ""


def normalize_route(path: str) -> str:
    return re.sub(r"[:{<]([^/>}]+)[>}]?", r":\1", path)


def extract_from_diff(diff: str, mounts: dict[str, str], excludes: list[str]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    by_file = added_lines_by_file(diff)
    for path, lines in by_file.items():
        if any(path.startswith(e.rstrip("/")) or f"/{e.strip('/')}/" in f"/{path}/" or path.endswith(e) for e in excludes):
            continue
        joined = "\n".join(t for _, t in lines)
        if path.endswith((".ts", ".js", ".cjs", ".mjs")):
            for match in ROUTE_RE.finditer(joined):
                method = match.group(2).upper()
                raw = match.group(3)
                prefix = mount_prefix(path, mounts)
                full = (prefix.rstrip("/") + "/" + raw.lstrip("/")) if prefix else raw
                full = re.sub(r"/{2,}", "/", full)
                ident = f"{method} {full}"
                key = ("route", ident)
                if key in seen:
                    continue
                seen.add(key)
                items.append({"display": ident, "file": path, "id": ident, "line": 0, "type": "route"})
        if path.endswith((".ejs", ".html")):
            for rx, kind in ((TESTID_RE, "testid"), (ARIA_RE, "aria"), (BUTTON_RE, "button"), (LABEL_RE, "label")):
                for match in rx.finditer(joined):
                    ident = match.group(1).strip()
                    key = ("control", ident)
                    if key in seen:
                        continue
                    seen.add(key)
                    items.append({"display": ident, "file": path, "id": ident, "line": 0, "type": "control"})
    return items


def glob_files(repo: Path, tag: str, patterns: list[str]) -> tuple[list[str], str]:
    import fnmatch

    proc = subprocess.run(
        ["git", "ls-tree", "-r", "--name-only", tag],
        cwd=str(repo),
        capture_output=True,
        text=True,
        check=False,
    )
    names = [ln for ln in proc.stdout.splitlines() if ln]
    matched: list[str] = []
    texts: list[str] = []
    for name in names:
        if any(fnmatch.fnmatch(name, p) for p in patterns):
            blob = subprocess.run(
                ["git", "show", f"{tag}:{name}"],
                cwd=str(repo),
                capture_output=True,
                text=True,
                check=False,
            )
            if blob.returncode == 0:
                matched.append(name)
                texts.append(blob.stdout)
    return matched, "\n".join(texts)


def candidate_spec_files(repo: Path, tag: str, arm: str, matched: list[str]) -> list[str]:
    roots = {"conductor": "conductor/", "spec-kit": "specs/", "gatekit": "features/"}
    root = roots.get(arm, "")
    proc = subprocess.run(
        ["git", "ls-tree", "-r", "--name-only", tag],
        cwd=str(repo),
        capture_output=True,
        text=True,
        check=False,
    )
    extra = []
    matched_set = set(matched)
    for name in proc.stdout.splitlines():
        if root and name.startswith(root) and name not in matched_set:
            extra.append(name)
    return extra


def word_form(ident: str) -> str:
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", ident)
    s = re.sub(r"[-_]+", " ", s)
    return s.lower()


def match_item(item: dict[str, Any], spec_text: str, synonyms: dict[str, list[str]]) -> tuple[bool, str | None]:
    hay = _collapse(spec_text)
    ident = item["id"]
    candidates = [ident, ident.lower(), word_form(ident)]
    if item["type"] == "route":
        path = ident.split(" ", 1)[-1]
        candidates.extend([normalize_route(path), path.replace(":id", "{id}"), path.replace(":id", "<id>")])
        # also method+normalized
        method = ident.split(" ", 1)[0]
        candidates.append(f"{method} {normalize_route(path)}")
    if ident in synonyms:
        for phrase in synonyms[ident]:
            candidates.append(phrase)
            candidates.extend(generate_variants(phrase))
    for c in candidates:
        if c and _collapse(c) in hay:
            return True, c
    return False, None


def score_items(
    items: list[dict[str, Any]],
    spec_text: str,
    synonyms: dict[str, list[str]],
) -> list[dict[str, Any]]:
    out = []
    for item in items:
        ok, by = match_item(item, spec_text, synonyms)
        row = dict(item)
        row["matched"] = ok
        row["matched_by"] = by
        out.append(row)
    return out


def pct_of(matched: int, total: int) -> float | None:
    if total == 0:
        return None
    return round(100.0 * matched / total, 1)


def score_repo(repo: Path, base: str, tag: str, arm: str, rubric: Path | None = None) -> dict[str, Any]:
    rubric = rubric or (harness_dir() / "score" / "RUBRIC.md")
    cfg = load_config_from_rubric(rubric)
    diff = git_diff(repo, base, tag, list(cfg["excludes"]))
    items = extract_from_diff(diff, cfg["mounts"], list(cfg["excludes"]))
    patterns = list((cfg["globs"] or {}).get(arm) or [])
    spec_files, spec_text = glob_files(repo, tag, patterns)
    unmatched = candidate_spec_files(repo, tag, arm, spec_files)
    scored = score_items(items, spec_text, cfg["synonyms"] or {})
    matched = sum(1 for i in scored if i["matched"])
    total = len(scored)
    pct = pct_of(matched, total)
    return {
        "arm": arm,
        "items": scored,
        "matched": matched,
        "pct": pct,
        "spec_files": spec_files,
        "spec_layout_review": bool(unmatched),
        "tag": tag,
        "total": total,
        "unmatched_spec_candidates": unmatched,
    }


def match_manifest(
    manifest: list[dict[str, Any]] | dict[str, Any],
    spec_text: str,
    synonyms: dict[str, list[str]],
) -> dict[str, Any]:
    if isinstance(manifest, dict) and "items" in manifest:
        items = list(manifest["items"])
    elif isinstance(manifest, dict):
        items = [{"id": k, "type": v.get("type", "control") if isinstance(v, dict) else "control"} for k, v in manifest.items()]
    else:
        items = list(manifest)
    scored = score_items(items, spec_text, synonyms)
    matched = sum(1 for i in scored if i["matched"])
    total = len(scored)
    return {"items": scored, "matched": matched, "pct": pct_of(matched, total), "total": total}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--base", required=True)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--arm", required=True)
    parser.add_argument("--rubric", default="score/RUBRIC.md")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    out = score_repo(Path(args.repo), args.base, args.tag, args.arm, Path(args.rubric))
    text = json.dumps(out, indent=2, sort_keys=True) + "\n"
    sys.stdout.write(text)
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
