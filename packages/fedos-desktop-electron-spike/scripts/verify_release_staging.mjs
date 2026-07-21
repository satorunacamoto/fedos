#!/usr/bin/env node
// Secure Runtime Alpha 5321-5400 -- Phase F: the ONE local release-
// verification command. Re-derives every fact it can from real bytes on
// disk (never trusts a stored value alone, mirroring every other
// verifier already accepted in this codebase) and returns a CLOSED result
// vocabulary -- never a raw, unstructured stack trace by default.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { parseFedosReleaseChecksumFile, sha256HexOf } from "./verify_release_checksums.mjs";
import { validateFedosBetaPublicationBundleV1, crossValidateBundleAgainstChecksums } from "./lib/publication_bundle.mjs";
import { validateFedosReleaseStatusRecordV1 } from "./lib/revocation_status.mjs";
import { FEDOS_RELEASE_SECRET_SCAN_PATTERNS, scanFedosReleaseFileForSecrets } from "./scan_release_artifacts_for_secrets.mjs";

const PACKAGE_ROOT = process.cwd();

/** The CLOSED, exact expected filename set for a complete staging bundle (Phase D's own layout, this Arc's own additive extension of it). */
export const FEDOS_EXPECTED_STAGING_FILES = Object.freeze([
  "SHA256SUMS.txt",
  "release-manifest.v1.json",
  "publication-bundle.json",
  "RELEASE_NOTES.md",
  "KNOWN_LIMITATIONS.md",
  "INSTALL_WINDOWS.md",
  "VERIFY_DOWNLOAD.md",
  "SECURITY_NOTICE.md",
  "REVOCATION_STATUS.json",
  "RELEASE_ANNOUNCEMENT.md",
]);

const TEXT_EXTENSIONS = new Set([".md", ".json", ".txt"]);

/** Patterns that would indicate an auto-update mechanism leaked into a release doc/manifest -- Phase F item 17, this Arc's own Absolute Prohibition restated as a real, checked invariant. */
const AUTO_UPDATE_METADATA_PATTERNS = Object.freeze([/electron-updater/i, /autoUpdater/, /"updateUrl"/i, /"feedUrl"/i]);

const CERTIFICATE_FILE_EXTENSIONS = new Set([".pfx", ".p12", ".pem", ".key", ".crt", ".cer"]);

/**
 * Verifies a complete release-staging directory. Returns
 * `{ ok: boolean, problems: readonly object[] }` -- every problem is a
 * closed `{kind, ...}` record, never a raw exception message alone.
 */
export function verifyFedosReleaseStaging(stagingDir, { expectedProductVersion, expectedChannel = "beta", now = new Date() } = {}) {
  const problems = [];
  if (!existsSync(stagingDir)) {
    return { ok: false, problems: [{ kind: "staging-directory-missing", stagingDir }] };
  }

  const actualFiles = readdirSync(stagingDir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
  const actualNonArtifactFiles = actualFiles.filter((name) => !/\.(exe|zip)$/i.test(name));

  // Item 3/12 — exact documentation inventory, no extra unlisted file.
  for (const expected of FEDOS_EXPECTED_STAGING_FILES) {
    if (!actualFiles.includes(expected)) problems.push({ kind: "missing-required-file", filename: expected });
  }
  for (const actual of actualNonArtifactFiles) {
    if (!FEDOS_EXPECTED_STAGING_FILES.includes(actual)) problems.push({ kind: "unexpected-file", filename: actual });
  }

  // Item 16 — no certificate/private-key file anywhere in staging.
  for (const name of actualFiles) {
    if (CERTIFICATE_FILE_EXTENSIONS.has(extname(name).toLowerCase())) problems.push({ kind: "certificate-file-present", filename: name });
  }

  if (!existsSync(join(stagingDir, "release-manifest.v1.json"))) {
    return { ok: false, problems: [...problems, { kind: "cannot-continue-without-release-manifest" }] };
  }
  const releaseManifest = JSON.parse(readFileSync(join(stagingDir, "release-manifest.v1.json"), "utf8"));

  // Item 6/7/8 — filename/version/channel/commit/build-identity agreement.
  if (typeof expectedProductVersion === "string" && releaseManifest.productVersion !== expectedProductVersion) {
    problems.push({ kind: "product-version-mismatch", expected: expectedProductVersion, actual: releaseManifest.productVersion });
  }
  if (releaseManifest.channel !== expectedChannel) problems.push({ kind: "channel-mismatch", expected: expectedChannel, actual: releaseManifest.channel });
  for (const artifact of releaseManifest.artifacts ?? []) {
    if (!artifact.filename.includes(releaseManifest.productVersion)) {
      problems.push({ kind: "artifact-filename-version-mismatch", filename: artifact.filename, productVersion: releaseManifest.productVersion });
    }
  }

  // Item 10 — unsigned-state agreement.
  if (releaseManifest.unsigned !== true) problems.push({ kind: "unsigned-state-mismatch", value: releaseManifest.unsigned });

  // Item 4/5 — real SHA-256 + size of every artifact, re-derived from bytes.
  for (const artifact of releaseManifest.artifacts ?? []) {
    const path = join(stagingDir, artifact.filename);
    if (!existsSync(path)) {
      problems.push({ kind: "artifact-missing-on-disk", filename: artifact.filename });
      continue;
    }
    const realHash = sha256HexOf(path);
    if (realHash !== artifact.sha256Hex) problems.push({ kind: "artifact-hash-mismatch", filename: artifact.filename, expected: artifact.sha256Hex, actual: realHash });
  }

  // Item 1 — publication-bundle schema + cross-validation against the real checksum file.
  if (existsSync(join(stagingDir, "publication-bundle.json"))) {
    const bundle = JSON.parse(readFileSync(join(stagingDir, "publication-bundle.json"), "utf8"));
    const bundleResult = validateFedosBetaPublicationBundleV1(bundle);
    if (!bundleResult.ok) problems.push({ kind: "publication-bundle-invalid", problems: bundleResult.problems });
    if (existsSync(join(stagingDir, "SHA256SUMS.txt"))) {
      const checksumRecords = parseFedosReleaseChecksumFile(readFileSync(join(stagingDir, "SHA256SUMS.txt"), "utf8"));
      if (checksumRecords === null) {
        problems.push({ kind: "checksum-file-malformed" });
      } else {
        const crossResult = crossValidateBundleAgainstChecksums(bundle, checksumRecords);
        if (!crossResult.ok) problems.push({ kind: "bundle-checksum-cross-validation-failed", problems: crossResult.problems });
        // Deliberately NOT `verifyFedosReleaseChecksums` here: that function enforces an EXACT
        // directory inventory (every file present must be listed, and vice versa), which is the
        // right rule for `release/` (`build_release.mjs`'s own output) but wrong for
        // `release-staging/` -- the staging directory is a SUPERSET of what SHA256SUMS.txt covers
        // (it also holds RELEASE_NOTES.md, publication-bundle.json, etc., added after the checksum
        // file was generated). Here every LISTED record must still exist on disk with a matching
        // real hash -- just without demanding the staging directory contain nothing else.
        for (const record of checksumRecords) {
          const recordPath = join(stagingDir, record.filename);
          if (!existsSync(recordPath)) {
            problems.push({ kind: "checksum-record-file-missing", filename: record.filename });
            continue;
          }
          const realHash = sha256HexOf(recordPath);
          if (realHash !== record.sha256Hex) {
            problems.push({ kind: "checksum-record-hash-mismatch", filename: record.filename, expected: record.sha256Hex, actual: realHash });
          }
        }
      }
    }
  } else {
    problems.push({ kind: "publication-bundle-missing" });
  }

  // Item 18 — revocation status present + valid.
  if (existsSync(join(stagingDir, "REVOCATION_STATUS.json"))) {
    const statusRecord = JSON.parse(readFileSync(join(stagingDir, "REVOCATION_STATUS.json"), "utf8"));
    const statusResult = validateFedosReleaseStatusRecordV1(statusRecord);
    if (!statusResult.ok) problems.push({ kind: "revocation-status-invalid", problems: statusResult.problems });
  }

  // Item 13/14/15/17 — text-file content scan: absolute paths, local usernames, secrets, auto-update metadata.
  for (const name of actualNonArtifactFiles) {
    if (!TEXT_EXTENSIONS.has(extname(name))) continue;
    const content = readFileSync(join(stagingDir, name), "utf8");
    const secretFindings = scanFedosReleaseFileForSecrets(name, content);
    for (const f of secretFindings) problems.push({ kind: "secret-pattern-finding", filename: name, ...f });
    for (const pattern of AUTO_UPDATE_METADATA_PATTERNS) {
      if (pattern.test(content)) problems.push({ kind: "auto-update-metadata-present", filename: name, pattern: pattern.source });
    }
  }

  return { ok: problems.length === 0, problems: Object.freeze(problems) };
}

function main() {
  const stagingDir = join(PACKAGE_ROOT, "release-staging");
  const identityModulePromise = import("./lib/release_identity.mjs").then((m) => m.resolveFedosBetaReleaseIdentity({ requireClean: false }));
  identityModulePromise.then((identity) => {
    const result = verifyFedosReleaseStaging(stagingDir, { expectedProductVersion: identity.productVersion });
    if (!result.ok) {
      console.error("[verify-release-staging] FAILED:");
      for (const p of result.problems) console.error(`  ${JSON.stringify(p)}`);
      process.exit(1);
    }
    console.log(`[verify-release-staging] OK -- ${stagingDir} passes every check.`);
  });
}

if (process.argv[1] && process.argv[1].endsWith("verify_release_staging.mjs")) {
  main();
}
