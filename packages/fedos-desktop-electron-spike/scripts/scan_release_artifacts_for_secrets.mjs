#!/usr/bin/env node
// Secure Runtime Alpha 5241-5320 -- Phase N: artifact secret/content scan.
//
// SCANS THE STAGING INPUTS, not the final compressed containers. The NSIS
// installer applies its own internal (LZMA) compression and the ZIP's
// entries, while stored uncompressed by this Arc's own
// `"compression": "store"` electron-builder setting, still sit inside a
// ZIP central-directory structure -- neither is a reliable target for a
// naive raw-byte substring scan (LZMA-compressed regions do not contain
// contiguous plaintext at all, and partial/binary-safe ZIP parsing is
// real, unnecessary complexity this Arc does not need). The staging
// inputs -- the compiled `.cjs`/`.js`/`.html` files this package's own
// `files`/`extraFiles`/`extraResources` config selects (`01`) -- are
// EXACTLY the content that ends up inside the packaged artifacts, and
// are plain, greppable UTF-8 text. Scanning them is both more reliable
// and strictly a superset check: nothing reaches the final artifact
// without passing through this staging step first.
//
// HONEST LIMIT (Phase N's own "do not overclaim string scanning proves
// total secret absence"): this catches literal, unobfuscated string
// matches only -- it cannot detect a secret split across multiple
// variables, base64/hex-encoded at rest, or introduced by a future
// dependency this scan's own pattern list does not yet name.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const PACKAGE_ROOT = process.cwd();
const ROOT = join(PACKAGE_ROOT, "..", "..");

/** Every directory this scan walks -- the ACTUAL staging inputs electron-builder packages (`01`), never the whole repository. */
function stagingTargets() {
  const targets = [];
  const electronDist = join(PACKAGE_ROOT, "dist");
  if (existsSync(electronDist)) targets.push(electronDist);
  const rootDist = join(ROOT, "dist");
  if (existsSync(rootDist)) targets.push(rootDist);
  const wasmPkg = join(ROOT, "packages", "fedos-core-rust", "pkg");
  if (existsSync(wasmPkg)) targets.push(wasmPkg);
  return targets;
}

const SCANNED_EXTENSIONS = new Set([".cjs", ".js", ".html", ".json", ".d.ts", ".ts"]);

/** The closed set of prohibited patterns (Phase N, verbatim categories). Each entry names WHY it is prohibited, not just what it matches. */
export const FEDOS_RELEASE_SECRET_SCAN_PATTERNS = Object.freeze([
  { id: "pem-private-key", pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, reason: "an embedded PEM private key" },
  { id: "pem-certificate", pattern: /-----BEGIN CERTIFICATE-----/, reason: "an embedded PEM certificate" },
  { id: "known-test-passphrase", pattern: /correct horse battery staple/i, reason: "the repository's own well-known test passphrase fixture" },
  { id: "dotenv-secret-assignment", pattern: /^\s*[A-Z_]*(SECRET|API_KEY|PRIVATE_KEY|PASSWORD|ACCESS_TOKEN)[A-Z0-9_]*\s*=\S/m, reason: "a shell/.env-style secret-shaped KEY=VALUE assignment line" },
  { id: "npm-token", pattern: /npm_[A-Za-z0-9]{36}/, reason: "an npm authentication token" },
  { id: "github-token", pattern: /gh[pousr]_[A-Za-z0-9]{20,}/, reason: "a GitHub access token" },
  { id: "git-credential-url", pattern: /https?:\/\/[^\s"'/]+:[^\s"'/@]+@[^\s"'/]+/, reason: "a credential embedded in a URL (user:pass@host)" },
  { id: "worktree-absolute-path", pattern: /C:\\wt\\[A-Za-z0-9_-]+/, reason: "a local dedicated-worktree absolute path (should never survive into shipped output)" },
  { id: "windows-user-profile-path", pattern: /C:\\Users\\[A-Za-z0-9._-]+\\/, reason: "a local absolute Windows user-profile path" },
  { id: "dev-master-seed-double", pattern: /DevelopmentFedosMasterSeedAuthority/, reason: "the dev-only Master Seed double must never reach the normal packaged production entry point" },
]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (SCANNED_EXTENSIONS.has(extname(entry.name))) out.push(path);
  }
  return out;
}

/** Scans one file's own text content against every pattern; returns closed finding records (never partial/guessed matches). */
export function scanFedosReleaseFileForSecrets(path, content) {
  const findings = [];
  for (const { id, pattern, reason } of FEDOS_RELEASE_SECRET_SCAN_PATTERNS) {
    if (pattern.test(content)) findings.push({ file: path, patternId: id, reason });
  }
  return findings;
}

function main() {
  const targets = stagingTargets();
  if (targets.length === 0) {
    console.error("[secret-scan] no staging directories found (dist/, root dist/, or fedos-core-rust/pkg/) -- run the build steps first");
    process.exit(1);
  }
  const files = targets.flatMap(walk);
  const allFindings = [];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    allFindings.push(...scanFedosReleaseFileForSecrets(file, content));
  }
  if (allFindings.length > 0) {
    console.error(`[secret-scan] FAILED -- ${allFindings.length} finding(s):`);
    for (const f of allFindings) console.error(`  ${f.file}: ${f.patternId} (${f.reason})`);
    process.exit(1);
  }
  console.log(`[secret-scan] OK -- scanned ${files.length} staging file(s) across ${targets.length} target director(y/ies), 0 findings`);
  console.log("[secret-scan] NOTE: this scans staging inputs, not the compressed NSIS/ZIP containers themselves (see this script's own header for why); it cannot prove total secret absence.");
}

if (process.argv[1] && process.argv[1].endsWith("scan_release_artifacts_for_secrets.mjs")) {
  main();
}
