"""Sanitizer tests: S1–S8, idempotence, check mode, missing blocklist."""
from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from run.common import EXIT_ENVIRONMENT, EXIT_PRECONDITION
from run import sanitize as sanitize_mod


class TestSanitize(unittest.TestCase):
    def setUp(self) -> None:
        self.td = Path(tempfile.mkdtemp())
        self.bl = self.td / "blocklist.txt"
        self.bl.write_text("SYNTH-EMPLOYER-TOKEN\nnot-a-real-org\n", encoding="utf-8")
        self.tokens = sanitize_mod.load_blocklist(self.bl)

    def test_strips_url_id_path_email_account(self) -> None:
        raw = (
            "see https://cursor.com/agents/bc-abcdef123456\n"
            "id bc-abcdef123456\n"
            "path /Users/someone/proj and /tmp/pubrun/run/x\n"
            "mail a.b@example.com\n"
            "cursor-account: secret-user\n"
        )
        out, n = sanitize_mod.sanitize_text(raw, self.tokens)
        self.assertNotIn("cursor.com/agents", out)
        self.assertNotIn("bc-abcdef", out)
        self.assertNotIn("/Users/", out)
        self.assertNotIn("/tmp/pubrun/", out)
        self.assertNotIn("example.com", out)
        self.assertNotIn("secret-user", out)
        self.assertGreater(n, 0)

    def test_surviving_pattern_exits_2(self) -> None:
        # Force a leftover by skipping replacement then checking
        hits = sanitize_mod.check_pass("https://cursor.com/agents/bc-abcdef123456", self.tokens)
        self.assertTrue(hits)
        with self.assertRaises(SystemExit) as ctx:
            sanitize_mod.sanitize_text("https://cursor.com/agents/bc-abcdef123456 leftover cursor.com/agents/zz", self.tokens)
        # if S1 replacement is complete this may succeed; a constructed leftover:
        leftover = "<run-url removed> cursor.com/agents/still"
        with self.assertRaises(SystemExit) as ctx2:
            sanitize_mod.sanitize_text(leftover, self.tokens)
        self.assertEqual(ctx2.exception.code, EXIT_PRECONDITION)

    def test_idempotent(self) -> None:
        raw = "mail x@y.com path /Users/me/a\n"
        once, _ = sanitize_mod.sanitize_text(raw, self.tokens)
        twice, n2 = sanitize_mod.sanitize_text(once, self.tokens)
        self.assertEqual(once, twice)
        self.assertEqual(n2, 0)

    def test_keeps_relative_diff_paths(self) -> None:
        diff = "+++ b/src/http/routes/api.ts\n+router.get('/items')\n"
        out, _ = sanitize_mod.sanitize_text(diff, self.tokens)
        self.assertIn("src/http/routes/api.ts", out)

    def test_strips_secret_shapes(self) -> None:
        raw = "sk-abcdefghijklmnopqrstuvwxyz0123 and xai-abcdefghijklmnopqrstuvwxyz0123\n"
        out, _ = sanitize_mod.sanitize_text(raw, self.tokens)
        self.assertNotIn("sk-abcdefghijklmnopqrstuvwxyz0123", out)
        self.assertNotIn("xai-abcdefghijklmnopqrstuvwxyz0123", out)

    def test_check_mode_tree_and_missing_blocklist(self) -> None:
        tree = self.td / "tree"
        tree.mkdir()
        (tree / "ok.txt").write_text("hello relative/path.ts\n", encoding="utf-8")
        notes = sanitize_mod.sanitize_tree(tree, self.tokens)
        self.assertIsInstance(notes, list)
        os.environ["HARNESS_BLOCKLIST"] = str(self.td / "missing.txt")
        try:
            with self.assertRaises(SystemExit) as ctx:
                sanitize_mod.load_blocklist()
            self.assertEqual(ctx.exception.code, EXIT_ENVIRONMENT)
        finally:
            os.environ.pop("HARNESS_BLOCKLIST", None)


if __name__ == "__main__":
    unittest.main()
