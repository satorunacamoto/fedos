#!/usr/bin/env node
// Secure Runtime Alpha 5241-5320 -- Phase F: the ONE deterministic
// sequential release-build pipeline for FedOS Desktop Beta 0.1.
//
// PRECONDITION (matches the existing, established `package:beta` script's
// own convention -- WASM has never been built automatically by any
// packaging script in this repository; it remains a separate, explicit,
// Rust-toolchain-dependent precondition): `npm run build:wasm` and
// `node scripts/generate_wasm_artifact_manifest.mjs` (both root) must
// already have produced a real `packages/fedos-core-rust/pkg/` before
// running this script. This script does not run Cargo, matching the
// Absolute Prohibition "do not run npm and Cargo concurrently" (this
// script is pure npm/Node, run strictly AFTER any Cargo step completes).
//
// Order (real steps this script performs):
//   1. verify a clean working tree (dirty-tree public artifacts forbidden)
//   2. verify the package allowlist config
//   3. build the root beta-runtime dist/ graph
//   4. build the Electron package (main/preload/renderer/static assets)
//   5. run electron-builder (NSIS + ZIP), via the EXISTING
//      package.json-snapshot/restore-protected wrapper
//      (`run_electron_builder_package_beta.mjs`, unmodified)
//   6. generate the release manifest
//   7. generate the release checksums
//   8. verify the release checksums (re-derived, not merely re-read)
//   9. scan the staging inputs for prohibited content
//  10. print the final artifact summary
//
// Root/Electron typecheck, cargo test, and `npm test` are run SEPARATELY
// (this Arc's own VERIFICATION sequence) -- this script is the release
// packaging pipeline itself, not a general test runner.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_ROOT = process.cwd();
const ROOT = join(PACKAGE_ROOT, "..", "..");
const RELEASE_DIR = join(PACKAGE_ROOT, "release");

function step(label, fn) {
  console.log(`\n[build-release] === ${label} ===`);
  fn();
}

/**
 * `npm` resolves to `npm.cmd` on Windows, a `.cmd` batch script — NOT a PE
 * executable the OS loader can spawn directly (confirmed this session:
 * naming `npm.cmd` explicitly to `execFileSync` still fails, `EINVAL`,
 * without `shell: true`; this is a documented Node/Windows platform
 * constraint, not something this script can route around). `shell: true`
 * is therefore genuinely required here, not merely convenient — Node's own
 * DEP0190 warning is about an ARRAY of args being re-parsed by the shell,
 * a real risk only when any argument could carry attacker-controlled
 * content; every `args` array this script ever passes is a fixed,
 * hardcoded literal (`["run", "build:beta-runtime"]`, etc.), never
 * external input, so the warning names a risk that does not apply to this
 * script's own fixed call sites. `node`/`git` are real executables on
 * every platform and never need `shell: true`.
 */
function run(cmd, args, cwd) {
  const needsShell = process.platform === "win32" && cmd === "npm";
  execFileSync(cmd, args, { cwd, stdio: "inherit", shell: needsShell });
}

function verifyCleanTree() {
  const status = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
  if (status.trim().length > 0) {
    console.error("[build-release] refusing to build a public release artifact from a dirty working tree:");
    console.error(status);
    process.exit(1);
  }
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  console.log(`[build-release] clean tree confirmed at commit ${commit}`);
}

function main() {
  step("1/9 verify clean working tree", verifyCleanTree);
  step("2/9 verify package allowlist", () => run(process.execPath, ["scripts/verify_release_package_allowlist.mjs"], PACKAGE_ROOT));
  step("3/9 build root beta-runtime dist/", () => run("npm", ["run", "build:beta-runtime"], ROOT));
  step("4/9 build Electron package", () => run("npm", ["run", "build"], PACKAGE_ROOT));
  step("5/9 run electron-builder (NSIS + ZIP)", () => run(process.execPath, ["scripts/run_electron_builder_package_beta.mjs"], PACKAGE_ROOT));
  step("6/9 generate release manifest", () => run(process.execPath, ["scripts/generate_release_manifest.mjs"], PACKAGE_ROOT));
  step("7/9 generate release checksums", () => run(process.execPath, ["scripts/generate_release_checksums.mjs"], PACKAGE_ROOT));
  step("8/9 verify release checksums", () => run(process.execPath, ["scripts/verify_release_checksums.mjs"], PACKAGE_ROOT));
  step("9/9 scan staging inputs for prohibited content", () => run(process.execPath, ["scripts/scan_release_artifacts_for_secrets.mjs"], PACKAGE_ROOT));

  console.log("\n[build-release] === final artifact summary ===");
  const manifest = JSON.parse(readFileSync(join(RELEASE_DIR, "release-manifest.v1.json"), "utf8"));
  console.log(`  productName:    ${manifest.productName}`);
  console.log(`  productVersion: ${manifest.productVersion}`);
  console.log(`  channel:        ${manifest.channel}`);
  console.log(`  gitCommit:      ${manifest.gitCommit}`);
  console.log(`  unsigned:       ${manifest.unsigned}`);
  for (const artifact of manifest.artifacts) {
    console.log(`  - ${artifact.filename} (${artifact.type}${artifact.primary ? ", primary" : ""}), ${artifact.sizeBytes} bytes, sha256=${artifact.sha256Hex}`);
  }
  const releaseFiles = readdirSync(RELEASE_DIR, { withFileTypes: true }).filter((e) => e.isFile());
  const totalBytes = releaseFiles.reduce((sum, e) => sum + statSync(join(RELEASE_DIR, e.name)).size, 0);
  console.log(`  release/ total: ${releaseFiles.length} file(s), ${totalBytes} bytes`);
  console.log("\n[build-release] OK");
}

main();
