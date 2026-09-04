#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: import.sh <file.jsonl>" >&2
  echo "requires SHELFMARK_COOKIE (see scripts/login.sh)" >&2
  echo "optional env: SHELFMARK_URL (default http://localhost:3000)" >&2
}

if [[ $# -lt 1 ]]; then
  usage
  exit 2
fi

if [[ -z "${SHELFMARK_COOKIE:-}" ]]; then
  usage
  exit 2
fi

FILE="$1"
if [[ ! -f "$FILE" ]]; then
  echo "import.sh: file not found: $FILE" >&2
  exit 2
fi

BASE="${SHELFMARK_URL:-http://localhost:3000}"
BASE="${BASE%/}"

ok_n=0
fail_n=0

first_error() {
  local body="$1"
  local err
  err="$(printf '%s' "$body" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p' | head -n 1)"
  if [[ -n "$err" ]]; then
    printf '%s' "$err"
    return
  fi
  err="$(printf '%s' "$body" | sed -n 's/.*"fields":{[^}]*"[a-z]*":"\([^"]*\)".*/\1/p' | head -n 1)"
  if [[ -n "$err" ]]; then
    printf '%s' "$err"
    return
  fi
  printf '%s' "unknown"
}

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "${line// }" ]] && continue
  [[ "$line" == \#* ]] && continue
  RESP="$(mktemp)"
  HTTP="$(
    curl -sS -o "$RESP" -w '%{http_code}' \
      -H "Content-Type: application/json" \
      -H "Cookie: ${SHELFMARK_COOKIE}" \
      --data-binary "$line" \
      "$BASE/api/items" || true
  )"
  BODY="$(cat "$RESP")"
  rm -f "$RESP"
  if [[ "$HTTP" == "201" ]]; then
    ID="$(printf '%s' "$BODY" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p' | head -n 1)"
    TITLE="$(printf '%s' "$BODY" | sed -n 's/.*"title":"\([^"]*\)".*/\1/p' | head -n 1)"
    printf 'ok    %s  %s\n' "${ID:-?}" "${TITLE:-}"
    ok_n=$((ok_n + 1))
  else
    ERR="$(first_error "$BODY")"
    printf 'fail  %s  %s\n' "$HTTP" "$ERR"
    fail_n=$((fail_n + 1))
  fi
done < "$FILE"

printf 'imported %s items (%s failed)\n' "$ok_n" "$fail_n"

if [[ "$fail_n" -gt 0 ]]; then
  exit 1
fi
exit 0
