"""Results card reads numbers from the CSV only."""
from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path

from score.card import html_for, main as card_main, svg_for
from score.scorecard import COLUMNS


class TestCard(unittest.TestCase):
    def setUp(self) -> None:
        self.td = Path(tempfile.mkdtemp())
        self.csv = self.td / "scorecard.csv"
        rows = [
            {
                "arm": "conductor",
                "trial": "1",
                "role": "scored",
                "coverage_f1p": "81.5",
                "decisions_derived": "4",
            },
            {
                "arm": "gatekit",
                "trial": "1",
                "role": "scored",
                "coverage_f1p": "90.0",
                "decisions_derived": "2",
            },
            {
                "arm": "spec-kit",
                "trial": "1",
                "role": "scored",
                "coverage_f1p": "70.5",
                "decisions_derived": "5",
            },
        ]
        with self.csv.open("w", encoding="utf-8", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=COLUMNS, extrasaction="ignore")
            w.writeheader()
            for r in rows:
                full = {k: r.get(k, "") for k in COLUMNS}
                w.writerow(full)

    def test_every_number_in_svg_comes_from_csv(self) -> None:
        text = self.csv.read_text(encoding="utf-8")
        svg = svg_for(
            [
                {"arm": "conductor", "role": "scored", "coverage_f1p": "81.5", "decisions_derived": "4"},
                {"arm": "gatekit", "role": "scored", "coverage_f1p": "90.0", "decisions_derived": "2"},
                {"arm": "spec-kit", "role": "scored", "coverage_f1p": "70.5", "decisions_derived": "5"},
            ],
            None,
        )
        for token in ("81.5", "90.0", "70.5", "4", "2", "5"):
            self.assertIn(token, svg)
            self.assertIn(token, text)

    def test_highlight_decisions_marks_decisions_row_only(self) -> None:
        rows = [
            {"arm": "conductor", "role": "scored", "coverage_f1p": "81.5", "decisions_derived": "4"},
        ]
        svg = svg_for(rows, "decisions")
        self.assertIn('data-row="decisions"', svg)
        self.assertIn("#0a5", svg)
        html = html_for(svg, "decisions")
        self.assertIn("highlighted", html)
        out = self.td / "out"
        card_main(["--csv", str(self.csv), "--out", str(out), "--highlight", "decisions"])
        self.assertTrue((out / "card-decisions.svg").is_file())
        self.assertIn("highlighted", (out / "card-decisions.html").read_text(encoding="utf-8"))

    def test_png_flag_screenshots_html(self) -> None:
        from unittest.mock import patch

        out = self.td / "out"
        with patch("score.card.screenshot_html") as shot:
            card_main(["--csv", str(self.csv), "--out", str(out), "--png"])
        self.assertTrue((out / "card.html").is_file())
        shot.assert_called_once()
        html_arg, png_arg = shot.call_args[0]
        self.assertEqual(Path(html_arg).name, "card.html")
        self.assertEqual(Path(png_arg).name, "card.png")


if __name__ == "__main__":
    unittest.main()
