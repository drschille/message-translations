#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

BATCH_SIZE=50
SAMPLE_LIMIT=50
MAX_STEPS=10000
CURSOR=""

print_help() {
  cat <<'EOF'
Usage: bash scripts/check-nb-integrity.sh [options]

Runs editorial:checkNbTranslationIntegrityChunk in a loop and forwards cursor automatically.

Options:
  --batch-size <n>    Sermons per chunk (default: 50)
  --sample-limit <n>  Missing paragraph sample cap per chunk (default: 50)
  --max-steps <n>     Safety stop for total chunk calls (default: 10000)
  --cursor <value>    Resume from an existing cursor
  -h, --help          Show this help

Examples:
  bash scripts/check-nb-integrity.sh
  bash scripts/check-nb-integrity.sh --batch-size 100 --sample-limit 200
  bash scripts/check-nb-integrity.sh --cursor "<saved-cursor>"
EOF
}

while (($#)); do
  case "$1" in
    --batch-size)
      BATCH_SIZE="${2:-}"
      shift 2
      ;;
    --sample-limit)
      SAMPLE_LIMIT="${2:-}"
      shift 2
      ;;
    --max-steps)
      MAX_STEPS="${2:-}"
      shift 2
      ;;
    --cursor)
      CURSOR="${2:-}"
      shift 2
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      print_help >&2
      exit 1
      ;;
  esac
done

STEP=0
TOTAL_SERMONS=0
TOTAL_PARAGRAPHS=0
LAST_CURSOR="$CURSOR"

while true; do
  STEP=$((STEP + 1))
  if (( STEP > MAX_STEPS )); then
    echo "ERROR: Reached --max-steps (${MAX_STEPS}) before completion." >&2
    exit 2
  fi

  if [[ -n "$LAST_CURSOR" ]]; then
    ARGS="{\"cursor\":\"${LAST_CURSOR}\",\"sermonBatchSize\":${BATCH_SIZE},\"sampleLimit\":${SAMPLE_LIMIT}}"
  else
    ARGS="{\"sermonBatchSize\":${BATCH_SIZE},\"sampleLimit\":${SAMPLE_LIMIT}}"
  fi

  RAW_OUTPUT="$(npx convex run editorial:checkNbTranslationIntegrityChunk "${ARGS}")"
  JSON_OUTPUT="$(node -e '
const raw = process.argv[1].trim();
try {
  const parsed = JSON.parse(raw);
  process.stdout.write(JSON.stringify(parsed));
  process.exit(0);
} catch {}
const first = raw.indexOf("{");
const last = raw.lastIndexOf("}");
if (first >= 0 && last > first) {
  const candidate = raw.slice(first, last + 1);
  const parsed = JSON.parse(candidate);
  process.stdout.write(JSON.stringify(parsed));
  process.exit(0);
}
throw new Error("Could not parse JSON from command output");
' "$RAW_OUTPUT")"

  CHUNK_SERMONS="$(node -e 'const o=JSON.parse(process.argv[1]); process.stdout.write(String(o.sermonsChecked ?? 0));' "$JSON_OUTPUT")"
  CHUNK_PARAGRAPHS="$(node -e 'const o=JSON.parse(process.argv[1]); process.stdout.write(String(o.paragraphsChecked ?? 0));' "$JSON_OUTPUT")"
  IS_DONE="$(node -e 'const o=JSON.parse(process.argv[1]); process.stdout.write(String(Boolean(o.isDone)));' "$JSON_OUTPUT")"
  NEXT_CURSOR="$(node -e 'const o=JSON.parse(process.argv[1]); process.stdout.write(o.cursor ?? "");' "$JSON_OUTPUT")"
  MISSING_COUNT="$(node -e 'const o=JSON.parse(process.argv[1]); process.stdout.write(String((o.missingParagraphIds ?? []).length));' "$JSON_OUTPUT")"

  TOTAL_SERMONS=$((TOTAL_SERMONS + CHUNK_SERMONS))
  TOTAL_PARAGRAPHS=$((TOTAL_PARAGRAPHS + CHUNK_PARAGRAPHS))

  echo "step=${STEP} sermons=${CHUNK_SERMONS} paragraphs=${CHUNK_PARAGRAPHS} missing=${MISSING_COUNT} done=${IS_DONE}"

  if (( MISSING_COUNT > 0 )); then
    echo "NB integrity failed in chunk ${STEP}." >&2
    echo "$JSON_OUTPUT" >&2
    exit 3
  fi

  if [[ "$IS_DONE" == "true" ]]; then
    echo "Completed. sermons=${TOTAL_SERMONS} paragraphs=${TOTAL_PARAGRAPHS}"
    exit 0
  fi

  if [[ -z "$NEXT_CURSOR" || "$NEXT_CURSOR" == "$LAST_CURSOR" ]]; then
    echo "ERROR: Cursor stalled or empty before completion at step ${STEP}." >&2
    echo "$JSON_OUTPUT" >&2
    exit 4
  fi

  LAST_CURSOR="$NEXT_CURSOR"
done
