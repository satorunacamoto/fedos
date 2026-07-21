#!/usr/bin/env node
// Secure Runtime Alpha 5241-5320 -- Phase H: release checksum publication.
//
// Generates one SHA256SUMS file covering every public artifact already
// staged in `release/` (the NSIS installer, the portable ZIP, and the
// release manifest itself) -- run AFTER `generate_release_manifest.mjs`
// so the manifest's own bytes are included. Format: `<64-hex-lowercase>
// <2 spaces><filename>`, one line per file, sorted by filename (stable,
// deterministic ordering), LF line endings. No absolute path is ever
// written -- every filename is bare (relative to `release/` itself).
//
// This is a SEPARATE, additive integrity system from the existing WASM
// artifact manifest (`fedos_production_wasm_artifact_manifest.ts`) --
// this file covers the PUBLIC release artifacts; that one covers the
// INTERNAL bundled WASM binary. Neither replaces the other (see
// docs/reviews/fedos_beta_distribution_v1/08_wasm_manifest_and_application_binding.md
// and .../07_release_artifact_integrity.md).
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const PACKAGE_ROOT = process.cwd();
const RELEASE_DIR = join(PACKAGE_ROOT, "release");
const CHECKSUM_FILENAME = "SHA256SUMS.txt";

function sha256HexOf(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function main() {
  const entries = readdirSync(RELEASE_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name !== CHECKSUM_FILENAME)
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  if (entries.length === 0) {
    throw new Error(`[release-checksums] no artifacts found under ${RELEASE_DIR} -- run generate_release_manifest.mjs first`);
  }

  const lines = entries.map((name) => `${sha256HexOf(join(RELEASE_DIR, name))}  ${name}`);
  const outPath = join(RELEASE_DIR, CHECKSUM_FILENAME);
  writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  console.log(`[release-checksums] wrote ${outPath} covering ${entries.length} file(s):`);
  for (const line of lines) console.log(`  ${line}`);
}

main();
