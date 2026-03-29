#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

function parseArgs(argv) {
  const args = {
    input: "branham/sermons.json",
    languageCode: "nb",
    siteUrl:
      process.env.VITE_CONVEX_SITE_URL ||
      process.env.CONVEX_SITE_URL ||
      "",
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--input" && argv[i + 1]) {
      args.input = argv[++i];
    } else if (token === "--language" && argv[i + 1]) {
      args.languageCode = argv[++i];
    } else if (token === "--site-url" && argv[i + 1]) {
      args.siteUrl = argv[++i];
    } else if (token === "--dry-run") {
      args.dryRun = true;
    } else if (token === "--help" || token === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${token}`);
      printHelp();
      process.exit(1);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/import-sermons.mjs [options]

Options:
  --input <path>       Input JSON file (default: branham/sermons.json)
  --site-url <url>     Convex site URL (default: VITE_CONVEX_SITE_URL/CONVEX_SITE_URL)
  --language <code>    Language code for translated metadata (default: nb)
  --dry-run            Transform only; do not POST to endpoint
  -h, --help           Show this help
`);
}

function cleanString(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toImportRecord(source, languageCode) {
  const title = cleanString(source.title);
  const date = cleanString(source.date);
  const tag = cleanString(source.tag);
  const location = cleanString(source.location);

  if (!title || !date || !tag) {
    return null;
  }

  const translatedTitle = cleanString(source.title_no);
  const translatedDescription = cleanString(source.description_no);

  const translations = [];
  if (translatedTitle || translatedDescription) {
    const translation = {
      languageCode,
    };
    if (translatedTitle) translation.title = translatedTitle;
    if (translatedDescription) translation.description = translatedDescription;
    translations.push(translation);
  }

  const record = {
    title,
    date,
    tag,
  };
  if (location) record.location = location;
  if (translations.length > 0) record.translations = translations;
  return record;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.input);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected input file to contain an array: ${inputPath}`);
  }

  const transformed = [];
  let skipped = 0;
  for (const source of parsed) {
    const mapped = toImportRecord(source, args.languageCode);
    if (!mapped) {
      skipped += 1;
      continue;
    }
    transformed.push(mapped);
  }

  const tempFile = path.join(
    os.tmpdir(),
    `sermons-import-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );
  fs.writeFileSync(tempFile, JSON.stringify(transformed), "utf8");

  console.log(
    `Prepared ${transformed.length} sermons from ${parsed.length} source rows (skipped ${skipped}).`,
  );
  console.log(`Payload file: ${tempFile}`);

  if (args.dryRun) {
    return;
  }

  if (!args.siteUrl) {
    throw new Error(
      "Missing site URL. Set VITE_CONVEX_SITE_URL/CONVEX_SITE_URL or pass --site-url.",
    );
  }

  const endpoint = `${args.siteUrl.replace(/\/$/, "")}/sermons/import`;
  console.log(`POST ${endpoint}`);

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
    ],
    { stdio: "inherit" },
  );

  if (curl.error) {
    throw curl.error;
  }
  if (curl.status !== 0) {
    process.exit(curl.status ?? 1);
  }
}

main();
