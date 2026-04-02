#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

BATCH_SIZE=50
SAMPLE_LIMIT=50
MAX_STEPS=10000
SOURCE_LANGUAGE="en"
ALLOW_SOURCE_FALLBACK="false"
DRY_RUN="false"
CURSOR=""

print_help() {
  cat <<'EOF'
Usage: bash scripts/repair-nb-integrity.sh [options]

Runs nb integrity checks in chunks and auto-repairs missing nb translations when found.

Options:
  --batch-size <n>              Sermons per chunk (default: 50)
  --sample-limit <n>            Missing paragraph sample cap per chunk (default: 50)
  --max-steps <n>               Safety stop for total chunk calls (default: 10000)
  --cursor <value>              Resume from an existing cursor
  --source-language <code>      Source language to copy from (default: en)
  --allow-source-fallback       Allow fallback to paragraph sourceText when source language row is missing
  --dry-run                     Show what would be repaired without writing
  -h, --help                    Show this help
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
    --source-language)
      SOURCE_LANGUAGE="${2:-}"
      shift 2
      ;;
    --allow-source-fallback)
      ALLOW_SOURCE_FALLBACK="true"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
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

parse_json() {
  node -e '
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
' "$1"
}

STEP=0
TOTAL_REPAIRED=0
TOTAL_MISSING=0
LAST_CURSOR="$CURSOR"

while true; do
  STEP=$((STEP + 1))
  if (( STEP > MAX_STEPS )); then
    echo "ERROR: Reached --max-steps (${MAX_STEPS}) before completion." >&2
    exit 2
  fi

  if [[ -n "$LAST_CURSOR" ]]; then
    CHECK_ARGS="{\"cursor\":\"${LAST_CURSOR}\",\"sermonBatchSize\":${BATCH_SIZE},\"sampleLimit\":${SAMPLE_LIMIT}}"
  else
    CHECK_ARGS="{\"sermonBatchSize\":${BATCH_SIZE},\"sampleLimit\":${SAMPLE_LIMIT}}"
  fi

  CHECK_RAW="$(npx convex run editorial:checkNbTranslationIntegrityChunk "${CHECK_ARGS}")"
  CHECK_JSON="$(parse_json "$CHECK_RAW")"

  CHUNK_MISSING_JSON="$(node -e 'const o=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify(o.missingParagraphIds ?? []));' "$CHECK_JSON")"
  CHUNK_MISSING_COUNT="$(node -e 'const o=JSON.parse(process.argv[1]); process.stdout.write(String((o.missingParagraphIds ?? []).length));' "$CHECK_JSON")"
  CHUNK_SERMONS="$(node -e 'const o=JSON.parse(process.argv[1]); process.stdout.write(String(o.sermonsChecked ?? 0));' "$CHECK_JSON")"
  CHUNK_PARAGRAPHS="$(node -e 'const o=JSON.parse(process.argv[1]); process.stdout.write(String(o.paragraphsChecked ?? 0));' "$CHECK_JSON")"
  IS_DONE="$(node -e 'const o=JSON.parse(process.argv[1]); process.stdout.write(String(Boolean(o.isDone)));' "$CHECK_JSON")"
  NEXT_CURSOR="$(node -e 'const o=JSON.parse(process.argv[1]); process.stdout.write(o.cursor ?? "");' "$CHECK_JSON")"

  echo "step=${STEP} sermons=${CHUNK_SERMONS} paragraphs=${CHUNK_PARAGRAPHS} missing=${CHUNK_MISSING_COUNT} done=${IS_DONE}"

  if (( CHUNK_MISSING_COUNT > 0 )); then
    TOTAL_MISSING=$((TOTAL_MISSING + CHUNK_MISSING_COUNT))
    REPAIR_ARGS="{\"paragraphIds\":${CHUNK_MISSING_JSON},\"fromLanguageCode\":\"${SOURCE_LANGUAGE}\",\"allowSourceTextFallback\":${ALLOW_SOURCE_FALLBACK},\"dryRun\":${DRY_RUN}}"
    REPAIR_RAW="$(npx convex run editorial:repairMissingNbTranslations "${REPAIR_ARGS}")"
    REPAIR_JSON="$(parse_json "$REPAIR_RAW")"
    REPAIRED_COUNT="$(node -e 'const o=JSON.parse(process.argv[1]); process.stdout.write(String(o.repairedCount ?? 0));' "$REPAIR_JSON")"
    MISSING_SOURCE_COUNT="$(node -e 'const o=JSON.parse(process.argv[1]); process.stdout.write(String(o.missingSourceCount ?? 0));' "$REPAIR_JSON")"
    NOT_FOUND_COUNT="$(node -e 'const o=JSON.parse(process.argv[1]); process.stdout.write(String(o.notFoundCount ?? 0));' "$REPAIR_JSON")"
    TOTAL_REPAIRED=$((TOTAL_REPAIRED + REPAIRED_COUNT))

    echo "repair: repaired=${REPAIRED_COUNT} missingSource=${MISSING_SOURCE_COUNT} notFound=${NOT_FOUND_COUNT} dryRun=${DRY_RUN}"
    if (( MISSING_SOURCE_COUNT > 0 || NOT_FOUND_COUNT > 0 )); then
      echo "$REPAIR_JSON"
      echo "ERROR: Repair could not fix all missing IDs in this chunk." >&2
      exit 3
    fi
  fi

  if [[ "$IS_DONE" == "true" ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "Dry run completed. totalMissingSeen=${TOTAL_MISSING}"
    else
      echo "Completed. totalMissingSeen=${TOTAL_MISSING} totalRepaired=${TOTAL_REPAIRED}"
    fi
    exit 0
  fi

  if [[ -z "$NEXT_CURSOR" || "$NEXT_CURSOR" == "$LAST_CURSOR" ]]; then
    echo "ERROR: Cursor stalled or empty before completion at step ${STEP}." >&2
    echo "$CHECK_JSON" >&2
    exit 4
  fi
  LAST_CURSOR="$NEXT_CURSOR"
done
