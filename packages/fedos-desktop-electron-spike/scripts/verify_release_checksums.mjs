#!/usr/bin/env node
// Secure Runtime Alpha 5241-5320 -- Phase H/O: release checksum
// verification. Re-derives every file's own SHA-256 from the REAL bytes
// on disk (never trusts a stored value alone -- mirrors
// `fedos_production_wasm_artifact_manifest.ts`'s own
// "filenames/hashes are never trusted alone, recomputed at verify time"
// discipline) and fails closed on ANY of: a missing file, an extra
// unlisted file, a malformed checksum line, or a hash mismatch.
//
// Exit code 0 = every listed file verified; non-zero = at least one
// verification failure (also printed, never silently swallowed).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const PACKAGE_ROOT = process.cwd();
const RELEASE_DIR = join(PACKAGE_ROOT, "release");
const CHECKSUM_FILENAME = "SHA256SUMS.txt";

const HEX64 = /^[0-9a-f]{64}$/;

/** Parses `SHA256SUMS.txt`-shaped text into `{sha256Hex, filename}` records. Rejects (returns `null` for) any malformed line -- never guesses at a partial parse. */
export function parseFedosReleaseChecksumFile(text) {
  const records = [];
  const lines = text.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.length > 0);
  for (const line of lines) {
    const m = /^([0-9a-fA-F]{64})  (.+)$/.exec(line);
    if (m === null) return null;
    const hex = m[1].toLowerCase();
    if (!HEX64.test(hex)) return null;
    records.push({ sha256Hex: hex, filename: m[2] });
  }
  return records;
}

export function sha256HexOf(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * Verifies every record in a parsed checksum file against real files
 * under `dir`, AND that `dir` contains no extra, unlisted file (other
 * than the checksum file itself). Returns a closed, itemized result --
 * never throws for an ordinary verification failure (only for a
 * genuinely unexpected I/O error).
 */
export function verifyFedosReleaseChecksums(dir, records) {
  const problems = [];
  const listedNames = new Set(records.map((r) => r.filename));

  for (const record of records) {
    const path = join(dir, record.filename);
    if (!existsSync(path)) {
      problems.push({ kind: "missing-file", filename: record.filename });
      continue;
    }
    const actual = sha256HexOf(path);
    if (actual !== record.sha256Hex) {
      problems.push({ kind: "hash-mismatch", filename: record.filename, expected: record.sha256Hex, actual });
    }
  }

  const onDisk = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name) : [];
  for (const name of onDisk) {
    if (name === CHECKSUM_FILENAME) continue;
    if (!listedNames.has(name)) problems.push({ kind: "extra-unlisted-file", filename: name });
  }

  return Object.freeze({ ok: problems.length === 0, problems: Object.freeze(problems) });
}

function main() {
  const checksumPath = join(RELEASE_DIR, CHECKSUM_FILENAME);
  if (!existsSync(checksumPath)) {
    console.error(`[verify-checksums] ${checksumPath} does not exist -- run generate_release_checksums.mjs first`);
    process.exit(1);
  }
  const records = parseFedosReleaseChecksumFile(readFileSync(checksumPath, "utf8"));
  if (records === null) {
    console.error(`[verify-checksums] ${checksumPath} is malformed`);
    process.exit(1);
  }
  const result = verifyFedosReleaseChecksums(RELEASE_DIR, records);
  if (!result.ok) {
    console.error("[verify-checksums] FAILED:");
    for (const p of result.problems) console.error(`  ${JSON.stringify(p)}`);
    process.exit(1);
  }
  console.log(`[verify-checksums] OK -- ${records.length} file(s) verified against ${checksumPath}`);
}

// Only run as a CLI when invoked directly (not when imported by a test).
if (process.argv[1] && process.argv[1].endsWith("verify_release_checksums.mjs")) {
  main();
}
