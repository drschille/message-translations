#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

function printHelp() {
  console.log(`Usage: node scripts/import-sermon-paragraphs.mjs [options]

Options:
  --site-url <url>         Convex site URL (default: VITE_CONVEX_SITE_URL/CONVEX_SITE_URL)
  --paragraphs-dir <path>  Paragraph JSON directory (default: branham/paragraphs)
  --sermons-file <path>    Sermons JSON file with sid->tag map (default: branham/sermons.json)
  --language <code>        Translation language code for text_no (default: nb)
  --clean-existing         Delete existing sermon paragraph subtree before import
  --overwrite-existing     Upsert/update existing paragraphs in place
  --from-sid <number>      Optional lower SID bound (inclusive)
  --to-sid <number>        Optional upper SID bound (inclusive)
  --dry-run                Validate and print planned imports only
  --stop-on-error          Stop at first failed import
  -h, --help               Show this help
`);
}

function parseNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for ${flag}: ${value}`);
  }
  return parsed;
}

function parseArgs(argv) {
  const args = {
    siteUrl:
      process.env.VITE_CONVEX_SITE_URL ||
      process.env.CONVEX_SITE_URL ||
      process.env.VITE_CONVEX_URL ||
      "",
    paragraphsDir: "branham/paragraphs",
    sermonsFile: "branham/sermons.json",
    languageCode: "nb",
    cleanExisting: false,
    overwriteExisting: false,
    fromSid: null,
    toSid: null,
    dryRun: false,
    stopOnError: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--site-url") {
      const next = argv[i + 1];
      if (!next || next.trim() === "" || next.startsWith("--")) {
        throw new Error("Missing value for --site-url");
      }
      args.siteUrl = next;
      i += 1;
    } else if (token === "--paragraphs-dir" && argv[i + 1]) {
      args.paragraphsDir = argv[++i];
    } else if (token === "--sermons-file" && argv[i + 1]) {
      args.sermonsFile = argv[++i];
    } else if (token === "--language" && argv[i + 1]) {
      args.languageCode = argv[++i];
    } else if (token === "--clean-existing") {
      args.cleanExisting = true;
    } else if (token === "--overwrite-existing") {
      args.overwriteExisting = true;
    } else if (token === "--from-sid" && argv[i + 1]) {
      args.fromSid = parseNumber(argv[++i], "--from-sid");
    } else if (token === "--to-sid" && argv[i + 1]) {
      args.toSid = parseNumber(argv[++i], "--to-sid");
    } else if (token === "--dry-run") {
      args.dryRun = true;
    } else if (token === "--stop-on-error") {
      args.stopOnError = true;
    } else if (token === "--help" || token === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (args.cleanExisting && args.overwriteExisting) {
    throw new Error("--clean-existing and --overwrite-existing are mutually exclusive");
  }

  if (args.fromSid !== null && args.toSid !== null && args.fromSid > args.toSid) {
    throw new Error("--from-sid cannot be greater than --to-sid");
  }

  return args;
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function makeSidToTagMap(sermons) {
  const sidToTag = new Map();
  for (const sermon of sermons) {
    if (!sermon || typeof sermon !== "object") continue;
    if (typeof sermon.sid !== "number") continue;
    if (typeof sermon.tag !== "string" || sermon.tag.trim().length === 0) continue;
    sidToTag.set(sermon.sid, sermon.tag.trim());
  }
  return sidToTag;
}

function inRange(sid, fromSid, toSid) {
  if (fromSid !== null && sid < fromSid) return false;
  if (toSid !== null && sid > toSid) return false;
  return true;
}

function parseSidFromFilename(fileName) {
  const stem = fileName.replace(/\.json$/i, "");
  const sid = Number(stem);
  if (!Number.isFinite(sid)) return null;
  return sid;
}

function createPayload({ tag, paragraphs, languageCode, cleanExisting, overwriteExisting }) {
  return {
    sermonTag: tag,
    paragraphs,
    languageCode,
    cleanExisting,
    overwriteExisting,
  };
}

function normalizeSiteUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  if (trimmed.includes(".convex.cloud")) {
    const normalized = trimmed.replace(".convex.cloud", ".convex.site");
    console.warn(
      `Warning: site URL used .convex.cloud; switching to .convex.site -> ${normalized}`,
    );
    return normalized;
  }

  return trimmed;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const paragraphsDir = path.resolve(args.paragraphsDir);
  const sermonsFile = path.resolve(args.sermonsFile);

  if (!fs.existsSync(paragraphsDir)) {
    throw new Error(`Paragraphs directory not found: ${paragraphsDir}`);
  }
  if (!fs.existsSync(sermonsFile)) {
    throw new Error(`Sermons file not found: ${sermonsFile}`);
  }

  const sermons = readJsonFile(sermonsFile);
  if (!Array.isArray(sermons)) {
    throw new Error(`Expected array in sermons file: ${sermonsFile}`);
  }
  const sidToTag = makeSidToTagMap(sermons);

  const allFiles = fs
    .readdirSync(paragraphsDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => ({ file, sid: parseSidFromFilename(file) }))
    .filter((row) => row.sid !== null)
    .map((row) => ({ file: row.file, sid: row.sid }))
    .sort((a, b) => a.sid - b.sid)
    .filter((row) => inRange(row.sid, args.fromSid, args.toSid));

  let totalFiles = 0;
  let successCount = 0;
  let failedCount = 0;
  let skippedNoTag = 0;

  for (const row of allFiles) {
    totalFiles += 1;
    const tag = sidToTag.get(row.sid);
    if (!tag) {
      skippedNoTag += 1;
      console.error(`SKIP sid=${row.sid}: no matching sermon tag`);
      continue;
    }

    const filePath = path.join(paragraphsDir, row.file);
    const paragraphs = readJsonFile(filePath);
    if (!Array.isArray(paragraphs)) {
      failedCount += 1;
      console.error(`FAIL sid=${row.sid} tag=${tag}: expected paragraph array`);
      if (args.stopOnError) break;
      continue;
    }

    const payload = createPayload({
      tag,
      paragraphs,
      languageCode: args.languageCode,
      cleanExisting: args.cleanExisting,
      overwriteExisting: args.overwriteExisting,
    });

    if (args.dryRun) {
      console.log(
        `DRY sid=${row.sid} tag=${tag} paragraphs=${paragraphs.length} language=${args.languageCode}`,
      );
      successCount += 1;
      continue;
    }

    if (!args.siteUrl) {
      throw new Error(
        "Missing site URL. Set VITE_CONVEX_SITE_URL/CONVEX_SITE_URL or pass --site-url.",
      );
    }

    const endpoint = `${normalizeSiteUrl(args.siteUrl).replace(/\/$/, "")}/sermons/paragraphs/import`;
    const tempFile = path.join(
      os.tmpdir(),
      `sermon-paragraph-import-${row.sid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
    );
    fs.writeFileSync(tempFile, JSON.stringify(payload), "utf8");

    const curl = spawnSync(
      "curl",
      [
        "-sS",
        "-X",
        "POST",
        endpoint,
        "-H",
        "Content-Type: application/json",
        "--data-binary",
        `@${tempFile}`,
        "-w",
        "\n__HTTP_STATUS__:%{http_code}",
      ],
      { encoding: "utf8" },
    );

    fs.unlinkSync(tempFile);

    if (curl.error || curl.status !== 0) {
      failedCount += 1;
      console.error(
        `FAIL sid=${row.sid} tag=${tag}: curl exited with code ${curl.status ?? "unknown"}`,
      );
      if (curl.stderr) {
        console.error(curl.stderr.trim());
      }
      if (args.stopOnError) break;
      continue;
    }

    const raw = curl.stdout || "";
    const marker = "\n__HTTP_STATUS__:";
    const markerIndex = raw.lastIndexOf(marker);
    const body = markerIndex >= 0 ? raw.slice(0, markerIndex) : raw;
    const statusText = markerIndex >= 0 ? raw.slice(markerIndex + marker.length).trim() : "";
    const statusCode = Number(statusText);

    if (!Number.isFinite(statusCode) || statusCode < 200 || statusCode >= 300) {
      failedCount += 1;
      const snippet = body.trim().slice(0, 300).replace(/\s+/g, " ");
      console.error(
        `FAIL sid=${row.sid} tag=${tag}: HTTP ${Number.isFinite(statusCode) ? statusCode : "unknown"}${snippet ? ` body=${snippet}` : ""}`,
      );
      if (args.stopOnError) break;
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(body || "{}");
    } catch {
      failedCount += 1;
      const snippet = body.trim().slice(0, 300).replace(/\s+/g, " ");
      console.error(
        `FAIL sid=${row.sid} tag=${tag}: non-JSON response (HTTP ${statusCode})${snippet ? ` body=${snippet}` : ""}`,
      );
      if (args.stopOnError) break;
      continue;
    }

    const item = Array.isArray(parsed.results) ? parsed.results[0] : null;
    if (parsed.error || (item && item.error)) {
      failedCount += 1;
      const message = item?.error || parsed.message || parsed.error;
      console.error(`FAIL sid=${row.sid} tag=${tag}: ${message}`);
      if (args.stopOnError) break;
      continue;
    }

    successCount += 1;
    console.log(
      `OK sid=${row.sid} tag=${tag} inserted=${item?.inserted ?? 0} updated=${item?.updated ?? 0} deleted=${item?.deleted ?? 0} skipped=${item?.skipped ?? false}`,
    );
  }

  console.log("");
  console.log("Summary");
  console.log(`  Files considered: ${totalFiles}`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Failed: ${failedCount}`);
  console.log(`  Skipped (missing tag): ${skippedNoTag}`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

main();
