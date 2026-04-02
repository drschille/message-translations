#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

SITE_URL="${VITE_CONVEX_SITE_URL:-${CONVEX_SITE_URL:-}}"
PASS_ARGS=()

print_help() {
  cat <<'EOF'
Usage: bash scripts/import-paragraphs-clean.sh [options]

Runs paragraph import in clean mode (deletes existing paragraph subtree per sermon before import).
Schema expectation:
  - paragraph row "text" maps to sermonParagraphs.sourceText
  - paragraph row "text_no" maps to sermonParagraphTranslations.translatedText (language defaults to nb)
  - both fields must be non-empty

Options:
  --site-url <url>   Convex site URL override
  -h, --help         Show this help

All other options are passed through to:
  node scripts/import-sermon-paragraphs.mjs

Examples:
  bash scripts/import-paragraphs-clean.sh --site-url https://example.convex.site --from-sid 1 --to-sid 50
  bash scripts/import-paragraphs-clean.sh --dry-run --from-sid 1 --to-sid 5
EOF
}

while (($#)); do
  case "$1" in
    --site-url)
      if (($# < 2)); then
        echo "Missing value for --site-url" >&2
        exit 1
      fi
      SITE_URL="$2"
      shift 2
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      PASS_ARGS+=("$1")
      shift
      ;;
  esac
done

CMD=(node scripts/import-sermon-paragraphs.mjs --clean-existing)
if [[ -n "$SITE_URL" ]]; then
  CMD+=(--site-url "$SITE_URL")
fi
CMD+=("${PASS_ARGS[@]}")

echo "Running clean paragraph import..."
"${CMD[@]}"
