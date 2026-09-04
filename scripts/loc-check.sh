#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v git >/dev/null 2>&1; then
  echo "loc-check.sh: git is required (cloc --vcs=git)" >&2
  exit 1
fi

run_cloc() {
  cloc --vcs=git --fullpath \
    --not-match-d='^(\./)?harness(/|$)' \
    --not-match-f='(package-lock\.json|\.gitignore|\.dockerignore|\.env\.example)$' \
    .
}

if command -v cloc >/dev/null 2>&1; then
  TABLE="$(run_cloc)"
else
  if command -v docker >/dev/null 2>&1; then
    TABLE="$(
      docker run --rm -v "$ROOT:/data" -w /data aldanial/cloc \
        --vcs=git --fullpath \
        --not-match-d='^(\./)?harness(/|$)' \
        --not-match-f='(package-lock\.json|\.gitignore|\.dockerignore|\.env\.example)$' \
        .
    )"
  else
    echo "loc-check.sh: install cloc or docker to run the budget check" >&2
    exit 1
  fi
fi

printf '%s\n' "$TABLE"

N="$(printf '%s\n' "$TABLE" | awk '/^SUM:/ { print $NF; found=1 } END { if (!found) exit 1 }')"
if [[ -z "${N:-}" ]]; then
  echo "loc-check.sh: could not read SUM code column from cloc" >&2
  exit 1
fi

if [[ "$N" -lt 3500 || "$N" -gt 4500 ]]; then
  echo "LOC budget: ${N} (window 3500–4500) FAIL" >&2
  exit 1
fi

echo "LOC budget: ${N} (window 3500–4500) OK"
