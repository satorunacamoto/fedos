// Secure Runtime Alpha 5241-5320 -- Phase B: the ONE release-identity
// resolver every packaging script shares. Mirrors
// `scripts/generate_wasm_artifact_manifest.mjs`'s own established
// "regex-extract literal facts from the accepted TS/TOML source, never
// hand-maintain a duplicate copy" discipline -- this file reads the
// ALREADY-FROZEN `FedosDesktopBetaReleaseConfigurationV1` literal fields
// straight out of `src/desktop/beta/fedos_desktop_beta_release_configuration.ts`
// (never re-declares them), so a future bump to that one accepted source
// file is the ONLY place a release's own identity ever needs to change.
//
// No network access. No secret. Every field here is exactly the same
// non-secret fact the accepted release configuration already exposes to
// the running application itself (`fedosDesktopBetaReleaseConfigurationV1()`),
// plus build-time-only facts (git commit, WASM artifact hash) that object
// cannot know at compile time.
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from THIS FILE's own real location (`packages/fedos-desktop-electron-spike/scripts/lib/`),
// never from `process.cwd()` -- this module is imported directly by the test suite (running with the
// repository ROOT as cwd), not only invoked as a CLI from within the Electron package directory (where
// every OTHER script in this directory correctly uses `process.cwd()`, since they are never imported,
// only ever run as `node scripts/....mjs` from that package's own root).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const RELEASE_CONFIG_SOURCE = join(ROOT, "src", "desktop", "beta", "fedos_desktop_beta_release_configuration.ts");
const ARCHIVE_SCHEMA_SOURCE = join(ROOT, "src", "conversation", "archive", "fedos_conversation_archive_schema_version.ts");
const WASM_MANIFEST_PATH = join(ROOT, "packages", "fedos-core-rust", "pkg", "fedos_wasm_artifact_manifest.v1.json");

function requireMatch(source, pattern, label) {
  const m = pattern.exec(source);
  if (m === null) throw new Error(`[release-identity] could not find ${label} in ${RELEASE_CONFIG_SOURCE}`);
  return m[1];
}

/** Strictly-positive-integer Beta sequence parsed from the accepted `-beta.N` version suffix. Throws (never guesses) if the version string does not match the expected shape. */
function releaseSequenceFromVersion(version) {
  const m = /-beta\.(\d+)$/.exec(version);
  if (m === null) throw new Error(`[release-identity] version "${version}" does not end in the expected -beta.N suffix`);
  return Number.parseInt(m[1], 10);
}

function gitCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
}

function gitIsClean() {
  const status = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
  return status.trim().length === 0;
}

function electronPackageVersion() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "packages", "fedos-desktop-electron-spike", "package.json"), "utf8"));
  return pkg.version;
}

function wasmManifestIdentity() {
  if (!existsSync(WASM_MANIFEST_PATH)) return null;
  const manifest = JSON.parse(readFileSync(WASM_MANIFEST_PATH, "utf8"));
  return {
    schemaVersion: manifest.schemaVersion,
    crateName: manifest.crateName,
    crateVersion: manifest.crateVersion,
    wasmSha256Hex: manifest.wasmSha256Hex,
    compatibilityVersion: manifest.compatibilityVersion,
  };
}

/**
 * Resolves the ONE release identity for the current build. `requireClean`
 * (default `true`, matching the accepted V1 policy's own "dirty-tree
 * public release artifacts are forbidden") throws if the working tree has
 * any uncommitted change -- callers producing a LOCAL, non-published test
 * build may pass `false` explicitly, never silently.
 */
export function resolveFedosBetaReleaseIdentity({ requireClean = true } = {}) {
  const source = readFileSync(RELEASE_CONFIG_SOURCE, "utf8");
  const archiveSource = readFileSync(ARCHIVE_SCHEMA_SOURCE, "utf8");

  const productName = requireMatch(source, /productName:\s*"([^"]+)"/, "productName");
  const version = requireMatch(source, /version:\s*"([^"]+)"/, "version");
  const channel = requireMatch(source, /channel:\s*"([^"]+)"/, "channel");
  const buildIdentity = requireMatch(source, /buildIdentity:\s*"([^"]+)"/, "buildIdentity");
  const minimumSupportedPlatform = requireMatch(source, /minimumSupportedPlatform:\s*"([^"]+)"/, "minimumSupportedPlatform");
  const settingsSchemaVersion = Number.parseInt(requireMatch(source, /schemaVersions:\s*Object\.freeze\(\{\s*settings:\s*(\d+)/, "schemaVersions.settings"), 10);
  const profileSchemaVersion = Number.parseInt(requireMatch(source, /profile:\s*(\d+),\s*\n\s*capabilityManifest/, "schemaVersions.profile"), 10);
  const capabilityManifestSchemaVersion = Number.parseInt(requireMatch(source, /capabilityManifest:\s*(\d+),?\s*\n\s*\}\)/, "schemaVersions.capabilityManifest"), 10);
  const archiveSchemaVersion = Number.parseInt(requireMatch(archiveSource, /FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION\s*=\s*(\d+)/, "FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION"), 10);

  const clean = gitIsClean();
  if (requireClean && !clean) {
    throw new Error("[release-identity] refusing to resolve a release identity from a dirty working tree (accepted V1 policy: dirty-tree public release artifacts are forbidden)");
  }

  return Object.freeze({
    schemaVersion: 1,
    productName,
    productVersion: version,
    channel,
    releaseSequence: releaseSequenceFromVersion(version),
    gitCommit: gitCommit(),
    gitTreeClean: clean,
    buildIdentity,
    electronPackageVersion: electronPackageVersion(),
    wasmArtifactManifest: wasmManifestIdentity(),
    schemaVersions: Object.freeze({
      settings: settingsSchemaVersion,
      profile: profileSchemaVersion,
      capabilityManifest: capabilityManifestSchemaVersion,
      archive: archiveSchemaVersion,
    }),
    minimumSupportedPlatform,
    platform: "win32",
    architecture: "x64",
    unsigned: true,
    createdAt: new Date().toISOString(),
  });
}
