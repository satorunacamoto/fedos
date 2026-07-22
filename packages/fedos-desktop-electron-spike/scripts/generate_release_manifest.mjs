#!/usr/bin/env node
// Secure Runtime Alpha 5241-5320 -- Phase G: release manifest generation.
//
// Reads the two already-built public release artifacts (the NSIS
// installer and the portable ZIP, both already produced by
// `electron-builder` into `dist-package-beta/`) plus the release identity
// (`scripts/lib/release_identity.mjs`), and writes ONE machine-readable,
// versioned `release/release-manifest.v1.json`. No secret, no local
// absolute build path (every path recorded is a bare filename), no
// network access. Deterministic field ordering (`JSON.stringify` with an
// explicit key order, mirroring `generate_wasm_artifact_manifest.mjs`'s
// own plain, ordered object literal).
//
// Run AFTER `electron-builder` has produced the installer/ZIP, BEFORE
// `generate_release_checksums.mjs` (which also covers this manifest file
// itself).
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { resolveFedosBetaReleaseIdentity } from "./lib/release_identity.mjs";

const PACKAGE_ROOT = process.cwd();
const DIST_PACKAGE_DIR = join(PACKAGE_ROOT, "dist-package-beta");
const RELEASE_DIR = join(PACKAGE_ROOT, "release");
const KNOWN_LIMITATIONS_DOC = "fedos_desktop_beta_limitations.ts"; // the accepted, existing non-secret limitations model this release's own notes must reference -- see docs/secure_runtime_alpha_5241_5320_packaging_reconciliation_report.md.

function sha256HexOf(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Finds the ONE file directly under `dist-package-beta/` matching `pattern` -- fails closed (throws) on zero or more than one match, never guesses. */
function findOneArtifact(pattern, label) {
  const entries = readdirSync(DIST_PACKAGE_DIR, { withFileTypes: true }).filter((e) => e.isFile() && pattern.test(e.name));
  if (entries.length === 0) throw new Error(`[release-manifest] no ${label} artifact found under ${DIST_PACKAGE_DIR} (expected pattern ${pattern})`);
  if (entries.length > 1) throw new Error(`[release-manifest] more than one ${label} artifact found: ${entries.map((e) => e.name).join(", ")}`);
  return entries[0].name;
}

function artifactRecord(filename, kind, primary) {
  const path = join(RELEASE_DIR, filename);
  const stat = statSync(path);
  return Object.freeze({
    filename,
    type: kind,
    primary,
    sizeBytes: stat.size,
    sha256Hex: sha256HexOf(path),
  });
}

function main() {
  const identity = resolveFedosBetaReleaseIdentity({ requireClean: true });

  const nsisFilename = findOneArtifact(/\.exe$/i, "NSIS installer");
  const zipFilename = findOneArtifact(/\.zip$/i, "portable ZIP");

  // Copy the two curated public artifacts into release/ (kept SEPARATE from
  // electron-builder's own raw dist-package-beta/ output, which also holds
  // the unpacked win-unpacked/ intermediate this Arc never publishes) --
  // release/ becomes the ONE self-contained, ready-to-publish directory:
  // installer + ZIP + this manifest + (next) the checksum file.
  mkdirSync(RELEASE_DIR, { recursive: true });
  copyFileSync(join(DIST_PACKAGE_DIR, nsisFilename), join(RELEASE_DIR, nsisFilename));
  copyFileSync(join(DIST_PACKAGE_DIR, zipFilename), join(RELEASE_DIR, zipFilename));

  const artifacts = [
    artifactRecord(nsisFilename, "nsis-installer", true),
    artifactRecord(zipFilename, "portable-zip", false),
  ];

  const manifest = {
    schemaVersion: 1,
    productName: identity.productName,
    productVersion: identity.productVersion,
    channel: identity.channel,
    releaseSequence: identity.releaseSequence,
    gitCommit: identity.gitCommit,
    buildIdentity: identity.buildIdentity,
    createdAt: identity.createdAt,
    platform: identity.platform,
    architecture: identity.architecture,
    unsigned: identity.unsigned,
    artifacts,
    wasmArtifactManifest: identity.wasmArtifactManifest,
    supportedSchemaVersions: identity.schemaVersions,
    minimumSupportedPlatform: identity.minimumSupportedPlatform,
    knownLimitationsSource: KNOWN_LIMITATIONS_DOC,
  };

  mkdirSync(RELEASE_DIR, { recursive: true });
  const outPath = join(RELEASE_DIR, "release-manifest.v1.json");
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`[release-manifest] wrote ${outPath}`);
  console.log(`[release-manifest] productVersion=${manifest.productVersion} gitCommit=${manifest.gitCommit}`);
}

main();
