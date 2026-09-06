"""Results card rendered from scorecard.csv (numbers are read, never typed).

Make target: card.
Inputs: --csv scorecard.csv, --out dir, optional --png --highlight decisions.
Outputs: card.svg, card.html, and when --png a Chromium screenshot of the HTML.
Exit: 0 ok · 1 usage · 2 missing csv or png screenshot failure.
"""
from __future__ import annotations

import argparse
import csv
import html
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from run.common import ARMS, EXIT_OK, EXIT_PRECONDITION, EXIT_USAGE, die, write_text


def read_rows(path: Path) -> list[dict[str, str]]:
    rows = []
    with path.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            if not row.get("arm") or str(row.get("arm")).startswith("#"):
                continue
            if row.get("role") not in {"scored", "tie-break"}:
                continue
            rows.append(row)
    return rows


def svg_for(rows: list[dict[str, str]], highlight: str | None) -> str:
    lines = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="420">',
        '<rect width="100%" height="100%" fill="#fff"/>',
        '<text x="24" y="36" font-size="20" font-family="sans-serif">Spec coverage at done-f1p</text>',
    ]
    y = 80
    for arm in ARMS:
        arm_rows = [r for r in rows if r.get("arm") == arm]
        cov = ", ".join(str(r.get("coverage_f1p") or "") for r in arm_rows)
        dec = ", ".join(str(r.get("decisions_derived") or "") for r in arm_rows)
        fill = "#111"
        if highlight == "decisions":
            fill = "#0a5"
        lines.append(
            f'<text x="24" y="{y}" font-size="16" font-family="sans-serif" fill="#111">{html.escape(arm)} coverage {html.escape(cov)}</text>'
        )
        y += 24
        lines.append(
            f'<text x="24" y="{y}" font-size="16" font-family="sans-serif" fill="{fill}" data-row="decisions">{html.escape(arm)} decisions {html.escape(dec)}</text>'
        )
        y += 36
    lines.append("</svg>")
    return "\n".join(lines) + "\n"


def html_for(svg: str, highlight: str | None) -> str:
    mark = " highlighted" if highlight == "decisions" else ""
    return (
        "<!doctype html><html><body>"
        f'<div class="card{mark}">{svg}</div>'
        "</body></html>\n"
    )


def _chrome_bin() -> str | None:
    # Prefer the real binary. PATH wrappers on this host force a shared
    # --user-data-dir (for CDP) which makes --screenshot hang.
    for path in ("/opt/google/chrome/chrome", "/usr/bin/google-chrome-stable"):
        if Path(path).is_file():
            return path
    for name in ("google-chrome-stable", "chromium", "chromium-browser"):
        found = shutil.which(name)
        if found:
            return found
    return None


def screenshot_html(html_path: Path, png_path: Path) -> None:
    """Screenshot card.html to PNG via host Chromium (isolated profile)."""
    chrome = _chrome_bin()
    if not chrome:
        die(EXIT_PRECONDITION, "png requires chromium/google-chrome")
    png_path = png_path.resolve()
    html_path = html_path.resolve()
    png_path.parent.mkdir(parents=True, exist_ok=True)
    profile = Path(tempfile.mkdtemp(prefix="harness-card-chrome-"))
    try:
        proc = subprocess.run(
            [
                chrome,
                "--headless=new",
                "--no-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--hide-scrollbars",
                f"--user-data-dir={profile}",
                "--window-size=980,460",
                f"--screenshot={png_path}",
                html_path.as_uri(),
            ],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
    except subprocess.TimeoutExpired:
        shutil.rmtree(profile, ignore_errors=True)
        die(EXIT_PRECONDITION, "png screenshot timed out")
    shutil.rmtree(profile, ignore_errors=True)
    if proc.returncode != 0 or not png_path.is_file() or png_path.stat().st_size == 0:
        die(EXIT_PRECONDITION, "png screenshot failed")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--png", action="store_true")
    parser.add_argument("--highlight")
    args = parser.parse_args(argv)
    csv_path = Path(args.csv)
    if not csv_path.is_file():
        die(EXIT_PRECONDITION, f"missing {csv_path}")
    rows = read_rows(csv_path)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    svg = svg_for(rows, args.highlight)
    name = "card-decisions.svg" if args.highlight == "decisions" else "card.svg"
    html_name = "card-decisions.html" if args.highlight == "decisions" else "card.html"
    write_text(out / name, svg)
    write_text(out / html_name, html_for(svg, args.highlight))
    if args.png:
        png_name = "card-decisions.png" if args.highlight == "decisions" else "card.png"
        screenshot_html(out / html_name, out / png_name)
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
