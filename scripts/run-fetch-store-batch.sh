#!/usr/bin/env bash
# Drive fetch-and-store.ts across a list of <url> <domain> [policy_type] [product]
# lines on stdin. Static fetch first, --headless fallback if the result is
# thin or errored. Writes raw text directly to the DB (no analysis).
#
# Reports outcome per site to stdout. At end, writes a markdown summary to
# OUT_REPORT (default /tmp/fetch-store-report.md).
set -u
set -o pipefail

MIN_CHARS=${MIN_CHARS:-1500}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_REPORT=${OUT_REPORT:-/tmp/fetch-store-report.md}

idx=0
LINES=()
while IFS= read -r _line || [[ -n "$_line" ]]; do
  [[ -z "$_line" ]] && continue
  [[ "$_line" =~ ^# ]] && continue
  LINES+=("$_line")
done
total=${#LINES[@]}

OK=()
THIN=()
FAIL=()

run_fetch() {
  local mode="$1"
  local url="$2"
  local domain="$3"
  local ptype="$4"
  local product="$5"
  local args=( "$SCRIPT_DIR/fetch-and-store.ts" )
  [[ "$mode" == "headless" ]] && args+=( --headless )
  args+=( --url "$url" --domain "$domain" --policy-type "$ptype" )
  [[ -n "$product" ]] && args+=( --product "$product" )
  npx tsx "${args[@]}" 2>/dev/null
}

for line in "${LINES[@]}"; do
  idx=$((idx+1))
  url=$(awk '{print $1}' <<<"$line")
  domain=$(awk '{print $2}' <<<"$line")
  ptype=$(awk '{print $3}' <<<"$line")
  product=$(awk '{for(i=4;i<=NF;i++) printf $i (i==NF?"":" ")}' <<<"$line")
  ptype=${ptype:-privacy_policy}

  echo ""
  echo "=== [$idx/$total] $domain ($ptype${product:+ / $product}) — $url ==="

  out=$(run_fetch static "$url" "$domain" "$ptype" "$product" || true)
  chars=$(jq -r '.chars // empty' 2>/dev/null <<<"$out")
  http=$(jq -r '.httpStatus // empty' 2>/dev/null <<<"$out")
  ok=$(jq -r '.ok // empty' 2>/dev/null <<<"$out")
  thin=$(jq -r '.thin // empty' 2>/dev/null <<<"$out")
  echo "[static] ok=$ok chars=${chars:-?} http=${http:-?} thin=${thin:-?}"

  need_headless=0
  if [[ "$ok" != "true" ]]; then need_headless=1; fi
  if [[ "$thin" == "true" ]]; then need_headless=1; fi
  if [[ -n "${http:-}" && "$http" != "200" ]]; then need_headless=1; fi

  if [[ "$need_headless" -eq 1 ]]; then
    echo "[fallback] retrying with --headless"
    out=$(run_fetch headless "$url" "$domain" "$ptype" "$product" || true)
    chars=$(jq -r '.chars // empty' 2>/dev/null <<<"$out")
    http=$(jq -r '.httpStatus // empty' 2>/dev/null <<<"$out")
    ok=$(jq -r '.ok // empty' 2>/dev/null <<<"$out")
    thin=$(jq -r '.thin // empty' 2>/dev/null <<<"$out")
    echo "[headless] ok=$ok chars=${chars:-?} http=${http:-?} thin=${thin:-?}"
  fi

  if [[ "$ok" == "true" && "$thin" != "true" ]]; then
    OK+=("$domain ($ptype) — ${chars} chars")
    echo "[OK] $domain"
  elif [[ "$ok" == "true" && "$thin" == "true" ]]; then
    THIN+=("$domain ($ptype) — ${chars} chars http=$http — SPA or bot-walled; stored but thin")
    echo "[THIN] $domain — stored but flagged"
  else
    err=$(jq -r '.error // "unknown"' 2>/dev/null <<<"$out")
    FAIL+=("$domain ($ptype) — $err")
    echo "[FAIL] $domain — $err"
  fi
done

{
  echo "# Fetch-and-store report — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  echo "## OK (${#OK[@]})"
  for x in "${OK[@]:-}"; do [[ -n "$x" ]] && echo "- $x"; done
  echo ""
  echo "## THIN — stored but flagged for re-fetch (${#THIN[@]})"
  for x in "${THIN[@]:-}"; do [[ -n "$x" ]] && echo "- $x"; done
  echo ""
  echo "## FAILED (${#FAIL[@]})"
  for x in "${FAIL[@]:-}"; do [[ -n "$x" ]] && echo "- $x"; done
} > "$OUT_REPORT"

echo ""
echo "=== batch done: ${#OK[@]} ok, ${#THIN[@]} thin, ${#FAIL[@]} failed ==="
echo "report: $OUT_REPORT"
