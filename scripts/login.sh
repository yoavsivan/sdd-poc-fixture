#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: login.sh <username> <password>" >&2
  echo "optional env: SHELFMARK_URL (default http://localhost:3000)" >&2
}

if [[ $# -lt 2 ]]; then
  usage
  exit 2
fi

USERNAME="$1"
PASSWORD="$2"
BASE="${SHELFMARK_URL:-http://localhost:3000}"
BASE="${BASE%/}"

JAR="$(mktemp)"
BODY="$(mktemp)"
HDR="$(mktemp)"
cleanup() {
  rm -f "$JAR" "$BODY" "$HDR"
}
trap cleanup EXIT

curl -sS -c "$JAR" -b "$JAR" -D "$HDR" -o "$BODY" "$BASE/signin" >/dev/null

CSRF="$(sed -n 's/.*name="_csrf" value="\([^"]*\)".*/\1/p' "$BODY" | head -n 1)"
if [[ -z "$CSRF" ]]; then
  CSRF="$(sed -n 's/.*value="\([^"]*\)" name="_csrf".*/\1/p' "$BODY" | head -n 1)"
fi
if [[ -z "$CSRF" ]]; then
  echo "login.sh: could not find _csrf on /signin" >&2
  exit 1
fi

HTTP="$(
  curl -sS -o "$BODY" -D "$HDR" -w '%{http_code}' \
    -c "$JAR" -b "$JAR" \
    -X POST \
    --data-urlencode "_csrf=${CSRF}" \
    --data-urlencode "username=${USERNAME}" \
    --data-urlencode "password=${PASSWORD}" \
    "$BASE/signin"
)"

if [[ "$HTTP" == "401" ]]; then
  exit 1
fi

if [[ "$HTTP" != "302" && "$HTTP" != "303" && "$HTTP" != "200" ]]; then
  echo "login.sh: unexpected status ${HTTP}" >&2
  exit 1
fi

COOKIE="$(awk -F '\t' '
  $0 !~ /^#/ && NF >= 7 && $6 == "shelfmark.sid" { print $6 "=" $7; found=1 }
  END { if (!found) exit 1 }
' "$JAR" 2>/dev/null || true)"

if [[ -z "$COOKIE" ]]; then
  COOKIE="$(awk -F '\t' '
    $6 == "shelfmark.sid" { print $6 "=" $7; found=1 }
    END { if (!found) exit 1 }
  ' "$JAR")"
fi

printf '%s\n' "$COOKIE"
