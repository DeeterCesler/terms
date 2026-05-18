#!/usr/bin/env bash
# Bulk-fetch policy text for a list of <url> <domain> pairs (one per line on stdin).
# Static fetch first, --headless fallback when the static result is thin/errored.
# Writes each policy to /tmp/<domain>.policy.txt. Does NOT analyze or insert —
# that's a separate manual step (Claude analyzes locally, then scripts/insert-direct.ts).
set -u
set -o pipefail

MIN_CHARS=${MIN_CHARS:-1500}
OUT_DIR=${OUT_DIR:-/tmp}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

idx=0
LINES=()
while IFS= read -r _line || [[ -n "$_line" ]]; do
  LINES+=("$_line")
done
total=${#LINES[@]}

for line in "${LINES[@]}"; do
  idx=$((idx+1))
  url=$(printf '%s\n' "$line" | awk '{print $1}')
  domain=$(printf '%s\n' "$line" | awk '{print $2}')
  [[ -z "${url:-}" ]] && continue

  out="$OUT_DIR/${domain}.policy.txt"
  echo ""
  echo "=== [$idx/$total] $domain — $url -> $out ==="

  static_err=$(npx tsx "$SCRIPT_DIR/fetch-text.ts" "$url" "$out" 2>&1 >/dev/null) || static_rc=$?
  static_rc=${static_rc:-0}
  chars=$(printf '%s\n' "$static_err" | grep -oE 'chars=[0-9]+' | head -1 | cut -d= -f2 || true)
  http=$(printf '%s\n' "$static_err" | grep -oE 'status=[0-9]+' | head -1 | cut -d= -f2 || true)
  echo "[static] chars=${chars:-?} http=${http:-?} rc=$static_rc"

  needs_headless=0
  if [[ "$static_rc" -ne 0 ]]; then needs_headless=1; fi
  if [[ -n "${chars:-}" && "$chars" -lt "$MIN_CHARS" ]]; then needs_headless=1; fi
  if [[ -n "${http:-}" && "$http" != "200" ]]; then needs_headless=1; fi

  if [[ "$needs_headless" -eq 1 ]]; then
    echo "[fallback] retrying with --headless"
    head_err=$(npx tsx "$SCRIPT_DIR/fetch-text.ts" --headless "$url" "$out" 2>&1 >/dev/null) || head_rc=$?
    head_rc=${head_rc:-0}
    hchars=$(printf '%s\n' "$head_err" | grep -oE 'chars=[0-9]+' | head -1 | cut -d= -f2 || true)
    hhttp=$(printf '%s\n' "$head_err" | grep -oE 'status=[0-9]+' | head -1 | cut -d= -f2 || true)
    echo "[headless] chars=${hchars:-?} http=${hhttp:-?} rc=$head_rc"
    if [[ "$head_rc" -ne 0 ]]; then
      echo "[FAIL] $domain could not be fetched"
    else
      echo "[OK-headless] $domain -> $out"
    fi
  else
    echo "[OK-static] $domain -> $out"
  fi
  unset static_rc head_rc
done

echo ""
echo "=== batch fetch done ==="
