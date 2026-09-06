"""Held-out extractor tests: synonyms, specimens, synthetic diff, layout flag."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPECIMENS = HERE / "specimens"
SCORE_DIR = Path(os.environ.get("HARNESS_SCORE_DIR", str(HERE)))
if not SCORE_DIR.is_absolute():
    SCORE_DIR = (Path.cwd() / SCORE_DIR).resolve()
sys.path.insert(0, str(SCORE_DIR))
sys.path.insert(0, str(SCORE_DIR.parent))

import spec_coverage as sc  # noqa: E402


def _git(cwd: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=str(cwd), check=True, capture_output=True)


def _briefs() -> str:
    return sc._briefs_text(SCORE_DIR.parent)


def _cfg() -> dict:
    return sc.load_config_from_rubric(SCORE_DIR / "RUBRIC.md", SCORE_DIR.parent)


def _manifest() -> dict:
    return json.loads((SPECIMENS / "_synthetic" / "surface-manifest.json").read_text(encoding="utf-8"))


def _expected() -> dict:
    return json.loads((SPECIMENS / "EXPECTED.json").read_text(encoding="utf-8"))


def _spec_text(arm: str, variant: str) -> str:
    import fnmatch

    base = SPECIMENS / arm / variant
    patterns = list((_cfg()["globs"] or {}).get(arm) or [])
    parts = []
    for path in sorted(base.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(base).as_posix()
        if any(fnmatch.fnmatch(rel, p) for p in patterns):
            parts.append(path.read_text(encoding="utf-8"))
    return "\n".join(parts)


def _pct(arm: str, variant: str) -> float:
    cfg = _cfg()
    out = sc.match_manifest(_manifest(), _spec_text(arm, variant), cfg["synonyms"])
    return float(out["pct"])


class TestSpecCoverage(unittest.TestCase):
    def test_synonyms_come_from_briefs(self) -> None:
        cfg = _cfg()
        briefs = _briefs()
        for key, phrases in cfg["synonyms"].items():
            self.assertTrue(key.lower() in briefs or key in briefs, key)
            for phrase in phrases:
                self.assertIn(sc._collapse(phrase), briefs, phrase)

    def test_synonym_keys_and_no_route_keys(self) -> None:
        cfg = _cfg()
        for key in cfg["synonyms"]:
            self.assertFalse(key.startswith("GET "))
            self.assertFalse(key.startswith("POST "))
            self.assertFalse(key.startswith("/"))
        with self.assertRaises(SystemExit):
            sc.validate_synonyms({"GET /api/items": ["items"]}, _briefs())
        with self.assertRaises(SystemExit):
            sc.validate_synonyms({"not-in-briefs-xyz": ["named API key"]}, _briefs())

    def test_variants_generated(self) -> None:
        synonyms = {
            "api-key-create": ["named API key", "named API keys"],
        }
        with self.assertRaises(SystemExit):
            sc.validate_synonyms(synonyms, _briefs())
        variants = sc.generate_variants("named API key")
        self.assertTrue(any(v.lower() == "named api keys" for v in variants))

    def test_partial_specimens_equal_expected(self) -> None:
        expected = _expected()["partial"]
        c = _pct("conductor", "partial")
        s = _pct("spec-kit", "partial")
        g = _pct("gatekit", "partial")
        self.assertEqual(c, expected)
        self.assertEqual(s, expected)
        self.assertEqual(g, expected)
        self.assertEqual(c, s)
        self.assertEqual(s, g)

    def test_full_specimens_are_100(self) -> None:
        for arm in ("conductor", "spec-kit", "gatekit"):
            self.assertEqual(_pct(arm, "full"), 100.0)

    def test_matching_uses_manifest_not_extraction(self) -> None:
        cfg = _cfg()
        spec = _spec_text("conductor", "partial")
        matched = sc.match_manifest(_manifest(), spec, cfg["synonyms"])
        ids = {i["id"] for i in matched["items"]}
        self.assertEqual(ids, {i["id"] for i in _manifest()["items"]})
        diff = (SPECIMENS / "_synthetic" / "diff.patch").read_text(encoding="utf-8")
        extracted = sc.extract_from_diff(diff, cfg["mounts"], list(cfg["excludes"]))
        self.assertNotEqual({e["id"] for e in extracted}, ids)

    def test_synthetic_diff_routes_and_mounts(self) -> None:
        cfg = _cfg()
        diff = (SPECIMENS / "_synthetic" / "diff.patch").read_text(encoding="utf-8")
        items = sc.extract_from_diff(diff, cfg["mounts"], list(cfg["excludes"]))
        routes = {i["id"] for i in items if i["type"] == "route"}
        self.assertIn("GET /api/items", routes)
        self.assertIn("POST /api/keys", routes)
        self.assertIn("GET /api-keys", routes)

    def test_synthetic_diff_controls(self) -> None:
        cfg = _cfg()
        diff = (SPECIMENS / "_synthetic" / "diff.patch").read_text(encoding="utf-8")
        items = sc.extract_from_diff(diff, cfg["mounts"], list(cfg["excludes"]))
        controls = {i["id"] for i in items if i["type"] == "control"}
        self.assertIn("api-keys-section", controls)
        self.assertIn("api-key-plaintext", controls)
        self.assertIn("API keys", controls)
        self.assertIn("Create key", controls)
        self.assertIn("Key name", controls)

    def test_param_normalization_and_excludes(self) -> None:
        self.assertEqual(sc.normalize_route("/items/:id"), sc.normalize_route("/items/{id}"))
        self.assertEqual(sc.normalize_route("/items/:id"), sc.normalize_route("/items/<id>"))
        cfg = _cfg()
        diff = (SPECIMENS / "_synthetic" / "diff.patch").read_text(encoding="utf-8")
        items = sc.extract_from_diff(diff, cfg["mounts"], list(cfg["excludes"]))
        ids = {i["id"] for i in items}
        joined = " ".join(ids)
        self.assertNotIn("secret-trial-route", joined)
        self.assertNotIn("conductor-only", joined)
        self.assertNotIn("/handoff", joined)

    def test_layout_review_flag(self) -> None:
        src = SPECIMENS / "conductor" / "layout-review"
        repo = Path(tempfile.mkdtemp())
        shutil.copytree(src, repo, dirs_exist_ok=True)
        _git(repo, "init", "-b", "main")
        _git(repo, "config", "user.email", "a@b.c")
        _git(repo, "config", "user.name", "Apricode")
        _git(repo, "add", ".")
        _git(repo, "commit", "-m", "layout")
        patterns = list((_cfg()["globs"] or {}).get("conductor") or [])
        matched, text = sc.glob_files(repo, "HEAD", patterns)
        extra = sc.candidate_spec_files(repo, "HEAD", "conductor", matched)
        self.assertTrue(any(n.endswith("tasks.md") for n in extra))
        self.assertNotIn("LAYOUT-REVIEW-TASKS-ONLY-PHRASE", text)
        shutil.rmtree(repo, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
