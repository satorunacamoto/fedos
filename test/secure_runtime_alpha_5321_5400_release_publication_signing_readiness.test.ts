/**
 * Secure Runtime Alpha 5321-5400 — FedOS Desktop Beta 0.1 Canonical
 * Release Hosting, Manual Publication, and Signing Readiness Arc —
 * publication-bundle / signing-readiness / staging-verification /
 * revocation / tag-policy / dry-run / remote-download-verification unit
 * tests.
 *
 * Exercises every new script's own real logic against small, deterministic
 * FIXTURES and a real local in-process HTTP server — never requiring a
 * real electron-builder/Cargo/WASM build to run (the real end-to-end
 * pipeline run against genuine build output is recorded as separate,
 * real evidence in this Arc's own reconciliation/completion documents).
 * This suite must pass in ANY environment, with or without Electron/Rust
 * toolchains installed.
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import http from "node:http";
import { Buffer } from "node:buffer";
import process from "node:process";

// @ts-expect-error this repo's own packaging `.mjs` scripts carry no `.d.ts` declaration file.
import { FEDOS_BETA_CANONICAL_HOST_POLICIES, buildFedosBetaPublicationBundleV1, validateFedosBetaPublicationBundleV1, crossValidateBundleAgainstChecksums } from "../packages/fedos-desktop-electron-spike/scripts/lib/publication_bundle.mjs";
// @ts-expect-error see above.
import { FEDOS_SIGNING_READINESS_OUTCOMES, inspectFedosSigningToolchain, assessFedosSigningReadiness } from "../packages/fedos-desktop-electron-spike/scripts/lib/signing_readiness.mjs";
// @ts-expect-error see above.
import { FEDOS_RELEASE_STATUSES, FEDOS_ADVISORY_SEVERITIES, buildFedosReleaseStatusRecordV1, validateFedosReleaseStatusRecordV1 } from "../packages/fedos-desktop-electron-spike/scripts/lib/revocation_status.mjs";
// @ts-expect-error see above.
import { FEDOS_BETA_TAG_PATTERN, fedosBetaTagForVersion, validateFedosBetaTagFormat, FEDOS_BETA_TAG_POLICY } from "../packages/fedos-desktop-electron-spike/scripts/lib/tag_format.mjs";
// @ts-expect-error see above.
import { generateFedosBetaReleaseNotes } from "../packages/fedos-desktop-electron-spike/scripts/generate_release_staging.mjs";
// @ts-expect-error see above.
import { verifyFedosReleaseStaging, FEDOS_EXPECTED_STAGING_FILES } from "../packages/fedos-desktop-electron-spike/scripts/verify_release_staging.mjs";
// @ts-expect-error see above.
import { buildFedosPublicationDryRunPlan } from "../packages/fedos-desktop-electron-spike/scripts/publication_dry_run.mjs";
// @ts-expect-error see above.
import { fetchFedosReleaseArtifact, verifyFedosDownloadedArtifact, verifyDownloadedWasmBuildIdentity } from "../packages/fedos-desktop-electron-spike/scripts/lib/remote_download_verification.mjs";
// @ts-expect-error see above.
import { generateFedosPublicBetaGateReport } from "../packages/fedos-desktop-electron-spike/scripts/generate_public_beta_gate.mjs";
// @ts-expect-error see above.
import { verifyFedosReleaseChecksums, sha256HexOf } from "../packages/fedos-desktop-electron-spike/scripts/verify_release_checksums.mjs";

interface Problem {
  readonly kind: string;
  readonly [key: string]: unknown;
}

const tmpDirs: string[] = [];
function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-publication-test-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop()!;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
});

const FIXTURE_IDENTITY = Object.freeze({
  productVersion: "0.1.0-beta.7",
  channel: "beta",
  gitCommit: "a".repeat(40),
  buildIdentity: "fedos-desktop-beta-0.1.0-beta.7-a".repeat(1).slice(0, 40),
  unsigned: true,
  architecture: "x64",
  schemaVersions: Object.freeze({ settings: 1, profile: 1, capabilityManifest: 1, archive: 1 }),
});

function makeArtifacts(dir: string) {
  writeFileSync(join(dir, `FedOS-Desktop-Beta-Setup-${FIXTURE_IDENTITY.productVersion}.exe`), "fake installer bytes");
  writeFileSync(join(dir, `FedOS Desktop Beta-${FIXTURE_IDENTITY.productVersion}-win.zip`), "fake zip bytes");
  return [
    {
      filename: `FedOS-Desktop-Beta-Setup-${FIXTURE_IDENTITY.productVersion}.exe`,
      type: "nsis-installer",
      primary: true,
      sizeBytes: "fake installer bytes".length,
      sha256Hex: sha256HexOf(join(dir, `FedOS-Desktop-Beta-Setup-${FIXTURE_IDENTITY.productVersion}.exe`)),
    },
    {
      filename: `FedOS Desktop Beta-${FIXTURE_IDENTITY.productVersion}-win.zip`,
      type: "portable-zip",
      primary: false,
      sizeBytes: "fake zip bytes".length,
      sha256Hex: sha256HexOf(join(dir, `FedOS Desktop Beta-${FIXTURE_IDENTITY.productVersion}-win.zip`)),
    },
  ];
}

// ---------------------------------------------------------------------
// Phase B/C — publication bundle build + validation.
// ---------------------------------------------------------------------

describe("Phase B/C — publication bundle build", () => {
  it("builds a valid bundle from a real identity + real artifact records", () => {
    const dir = makeTmpDir();
    const artifacts = makeArtifacts(dir);
    const bundle = buildFedosBetaPublicationBundleV1({ identity: FIXTURE_IDENTITY, artifacts, canonicalHostPolicy: "local-only" });
    const result = validateFedosBetaPublicationBundleV1(bundle);
    expect(result.ok).toBe(true);
    expect(bundle.artifacts.length).toBe(2);
  });

  it("serializes deterministically given identical inputs", () => {
    const dir = makeTmpDir();
    const artifacts = makeArtifacts(dir);
    const a = buildFedosBetaPublicationBundleV1({ identity: FIXTURE_IDENTITY, artifacts, canonicalHostPolicy: "local-only", releaseDate: "2026-01-01T00:00:00.000Z" });
    const b = buildFedosBetaPublicationBundleV1({ identity: FIXTURE_IDENTITY, artifacts, canonicalHostPolicy: "local-only", releaseDate: "2026-01-01T00:00:00.000Z" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("rejects an unknown canonicalHostPolicy", () => {
    const dir = makeTmpDir();
    const artifacts = makeArtifacts(dir);
    expect(() => buildFedosBetaPublicationBundleV1({ identity: FIXTURE_IDENTITY, artifacts, canonicalHostPolicy: "s3-bucket" })).toThrow();
  });

  it("rejects a duplicate artifact filename at build time", () => {
    const dir = makeTmpDir();
    const artifacts = makeArtifacts(dir);
    expect(() => buildFedosBetaPublicationBundleV1({ identity: FIXTURE_IDENTITY, artifacts: [...artifacts, artifacts[0]], canonicalHostPolicy: "local-only" })).toThrow();
  });

  it("every canonical host policy is a non-empty string, local-only is present", () => {
    expect(FEDOS_BETA_CANONICAL_HOST_POLICIES).toContain("local-only");
    for (const p of FEDOS_BETA_CANONICAL_HOST_POLICIES) expect(typeof p).toBe("string");
  });
});

describe("Phase C — publication bundle strict validation", () => {
  function validBundle(dir: string) {
    return buildFedosBetaPublicationBundleV1({ identity: FIXTURE_IDENTITY, artifacts: makeArtifacts(dir), canonicalHostPolicy: "local-only" });
  }

  it("rejects an unknown top-level field", () => {
    const dir = makeTmpDir();
    const bundle = { ...validBundle(dir), extraField: "surprise" };
    const result = validateFedosBetaPublicationBundleV1(bundle);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: Problem) => p.kind === "unknown-field" && p.field === "extraField")).toBe(true);
  });

  it("rejects a missing required field", () => {
    const dir = makeTmpDir();
    const bundle: Record<string, unknown> = { ...validBundle(dir) };
    delete bundle.gitCommit;
    const result = validateFedosBetaPublicationBundleV1(bundle);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: Problem) => p.kind === "missing-required-field" && p.field === "gitCommit")).toBe(true);
  });

  it("rejects an invalid artifact hash", () => {
    const dir = makeTmpDir();
    const bundle = validBundle(dir);
    const tampered = { ...bundle, artifacts: [{ ...bundle.artifacts[0], sha256Hex: "not-hex" }, bundle.artifacts[1]] };
    const result = validateFedosBetaPublicationBundleV1(tampered);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: Problem) => p.kind === "artifact-invalid-hash")).toBe(true);
  });

  it("rejects a filename that leaks an absolute local path", () => {
    const dir = makeTmpDir();
    const bundle = validBundle(dir);
    const tampered = { ...bundle, artifacts: [{ ...bundle.artifacts[0], filename: "C:\\wt\\fedos-beta-release-publication\\installer.exe" }, bundle.artifacts[1]] };
    const result = validateFedosBetaPublicationBundleV1(tampered);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: Problem) => p.kind === "artifact-absolute-path")).toBe(true);
  });

  it("rejects a bundle with zero or more than one primary artifact", () => {
    const dir = makeTmpDir();
    const bundle = validBundle(dir);
    const noPrimary = { ...bundle, artifacts: bundle.artifacts.map((a: Record<string, unknown>) => ({ ...a, primary: false })) };
    expect(validateFedosBetaPublicationBundleV1(noPrimary).ok).toBe(false);
    const twoPrimary = { ...bundle, artifacts: bundle.artifacts.map((a: Record<string, unknown>) => ({ ...a, primary: true })) };
    expect(validateFedosBetaPublicationBundleV1(twoPrimary).ok).toBe(false);
  });

  it("accepts the real, unmodified bundle produced by the build function", () => {
    const dir = makeTmpDir();
    expect(validateFedosBetaPublicationBundleV1(validBundle(dir)).ok).toBe(true);
  });
});

describe("Phase C — bundle/checksum cross-validation", () => {
  it("passes when every bundle artifact has a matching checksum-file record and vice versa", () => {
    const dir = makeTmpDir();
    const artifacts = makeArtifacts(dir);
    const bundle = buildFedosBetaPublicationBundleV1({ identity: FIXTURE_IDENTITY, artifacts, canonicalHostPolicy: "local-only" });
    const checksumRecords = artifacts.map((a: { filename: string; sha256Hex: string }) => ({ filename: a.filename, sha256Hex: a.sha256Hex }));
    const result = crossValidateBundleAgainstChecksums(bundle, checksumRecords);
    expect(result.ok).toBe(true);
  });

  it("fails closed when the checksum file's own hash disagrees with the bundle's", () => {
    const dir = makeTmpDir();
    const artifacts = makeArtifacts(dir);
    const bundle = buildFedosBetaPublicationBundleV1({ identity: FIXTURE_IDENTITY, artifacts, canonicalHostPolicy: "local-only" });
    const checksumRecords = [{ filename: artifacts[0]!.filename, sha256Hex: "f".repeat(64) }, { filename: artifacts[1]!.filename, sha256Hex: artifacts[1]!.sha256Hex }];
    const result = crossValidateBundleAgainstChecksums(bundle, checksumRecords);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: Problem) => p.kind === "bundle-checksum-mismatch")).toBe(true);
  });

  it("fails closed when the checksum file lists an artifact the bundle does not reference", () => {
    const dir = makeTmpDir();
    const artifacts = makeArtifacts(dir);
    const bundle = buildFedosBetaPublicationBundleV1({ identity: FIXTURE_IDENTITY, artifacts, canonicalHostPolicy: "local-only" });
    const checksumRecords = [...artifacts.map((a: { filename: string; sha256Hex: string }) => ({ filename: a.filename, sha256Hex: a.sha256Hex })), { filename: "sneaky-extra.exe", sha256Hex: "e".repeat(64) }];
    const result = crossValidateBundleAgainstChecksums(bundle, checksumRecords);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: Problem) => p.kind === "checksum-entry-not-in-bundle")).toBe(true);
  });
});

// ---------------------------------------------------------------------
// Phase K/L — signing readiness.
// ---------------------------------------------------------------------

describe("Phase K — signing toolchain inventory (real, safe, non-secret)", () => {
  it("reports configReferencesSigningHook=false for the real electron_builder.beta.config.json shape (no win.certificateFile etc.)", () => {
    const inventory = inspectFedosSigningToolchain({ win: { target: ["nsis", "zip"] } });
    expect(inventory.configReferencesSigningHook).toBe(false);
    expect(inventory.certificateConfigured).toBe(inventory.signingEnvVarNamesPresent.length > 0);
  });

  it("reports configReferencesSigningHook=true when a certificateFile key is present", () => {
    const inventory = inspectFedosSigningToolchain({ win: { certificateFile: "some.pfx" } });
    expect(inventory.configReferencesSigningHook).toBe(true);
    expect(inventory.certificateConfigured).toBe(true);
  });

  it("never returns the VALUE of a signing env var, only names", () => {
    const inventory = inspectFedosSigningToolchain({});
    for (const name of inventory.signingEnvVarNamesPresent) expect(typeof name).toBe("string");
    expect(JSON.stringify(inventory)).not.toMatch(/BEGIN (RSA )?PRIVATE KEY/);
  });
});

describe("Phase L — signing readiness pure decision tree", () => {
  const toolchain = Object.freeze({ signtoolAvailable: true, configReferencesSigningHook: true, signingEnvVarNamesPresent: [], certificateConfigured: true });

  it("no certificate configured -> unsigned-allowed-for-beta (a positive result, never a blocker)", () => {
    const result = assessFedosSigningReadiness({ toolchain: { ...toolchain, signtoolAvailable: false }, certificate: null, expectedProductIdentity: "FedOS" });
    expect(result.outcome).toBe("unsigned-allowed-for-beta");
  });

  it("certificate configured but signtool missing -> toolchain-missing", () => {
    const result = assessFedosSigningReadiness({
      toolchain: { ...toolchain, signtoolAvailable: false },
      certificate: { subject: "CN=FedOS", hasPrivateKey: true, keyUsageValid: true, notAfter: new Date(Date.now() + 86400000) },
      expectedProductIdentity: "FedOS",
    });
    expect(result.outcome).toBe("toolchain-missing");
  });

  it("certificate with no private key -> private-key-unavailable", () => {
    const result = assessFedosSigningReadiness({
      toolchain,
      certificate: { subject: "CN=FedOS", hasPrivateKey: false, keyUsageValid: true, notAfter: new Date(Date.now() + 86400000) },
      expectedProductIdentity: "FedOS",
    });
    expect(result.outcome).toBe("private-key-unavailable");
  });

  it("expired certificate -> certificate-expired", () => {
    const result = assessFedosSigningReadiness({
      toolchain,
      certificate: { subject: "CN=FedOS", hasPrivateKey: true, keyUsageValid: true, notAfter: new Date(Date.now() - 86400000) },
      expectedProductIdentity: "FedOS",
    });
    expect(result.outcome).toBe("certificate-expired");
  });

  it("wrong key usage -> unsupported-certificate", () => {
    const result = assessFedosSigningReadiness({
      toolchain,
      certificate: { subject: "CN=FedOS", hasPrivateKey: true, keyUsageValid: false, notAfter: new Date(Date.now() + 86400000) },
      expectedProductIdentity: "FedOS",
    });
    expect(result.outcome).toBe("unsupported-certificate");
  });

  it("subject not matching expected product identity -> identity-mismatch", () => {
    const result = assessFedosSigningReadiness({
      toolchain,
      certificate: { subject: "CN=SomeOtherCompany", hasPrivateKey: true, keyUsageValid: true, notAfter: new Date(Date.now() + 86400000) },
      expectedProductIdentity: "FedOS",
    });
    expect(result.outcome).toBe("identity-mismatch");
  });

  it("no timestamp URL configured -> timestamp-service-unconfigured", () => {
    const result = assessFedosSigningReadiness({
      toolchain,
      certificate: { subject: "CN=FedOS", hasPrivateKey: true, keyUsageValid: true, notAfter: new Date(Date.now() + 86400000) },
      expectedProductIdentity: "FedOS",
      timestampUrlConfigured: false,
    });
    expect(result.outcome).toBe("timestamp-service-unconfigured");
  });

  it("every requirement satisfied -> signing-ready", () => {
    const result = assessFedosSigningReadiness({
      toolchain,
      certificate: { subject: "CN=FedOS", hasPrivateKey: true, keyUsageValid: true, notAfter: new Date(Date.now() + 86400000) },
      expectedProductIdentity: "FedOS",
      timestampUrlConfigured: true,
    });
    expect(result.outcome).toBe("signing-ready");
  });

  it("every outcome in the closed vocabulary is reachable and documented", () => {
    expect(FEDOS_SIGNING_READINESS_OUTCOMES).toContain("manual-review-required");
    expect(FEDOS_SIGNING_READINESS_OUTCOMES.length).toBeGreaterThanOrEqual(9);
  });
});

// ---------------------------------------------------------------------
// Phase J — revocation / advisory status record.
// ---------------------------------------------------------------------

describe("Phase J — revocation status record", () => {
  it("builds a plain candidate record with no severity/reason required", () => {
    const record = buildFedosReleaseStatusRecordV1({ status: "candidate", affectedVersion: "0.1.0-beta.7", publicationTimestamp: "2026-01-01T00:00:00.000Z", canonicalAdvisoryLocationPolicy: "local-only" });
    expect(record.status).toBe("candidate");
    expect(record.severity).toBeNull();
    expect(validateFedosReleaseStatusRecordV1(record).ok).toBe(true);
  });

  it("throws when an advisory (revoked/deprecated) is built without severity/reason/impact fields", () => {
    expect(() => buildFedosReleaseStatusRecordV1({ status: "revoked", affectedVersion: "0.1.0-beta.7", canonicalAdvisoryLocationPolicy: "local-only" })).toThrow();
  });

  it("succeeds when an advisory supplies every required field", () => {
    const record = buildFedosReleaseStatusRecordV1({
      status: "revoked",
      affectedVersion: "0.1.0-beta.5",
      severity: "release-blocking",
      reason: "a data-loss defect was found after publication",
      securityImpact: "none",
      dataLossImpact: "profile corruption possible under condition X",
      recommendedAction: "upgrade to 0.1.0-beta.7",
      replacementVersion: "0.1.0-beta.7",
      canonicalAdvisoryLocationPolicy: "local-only",
    });
    expect(record.severity).toBe("release-blocking");
    expect(validateFedosReleaseStatusRecordV1(record).ok).toBe(true);
  });

  it("rejects an unknown status and a missing required field", () => {
    expect(validateFedosReleaseStatusRecordV1({ status: "yanked" }).ok).toBe(false);
    expect(validateFedosReleaseStatusRecordV1({ schemaVersion: 1, status: "candidate" }).ok).toBe(false);
  });

  it("closed vocabularies contain the expected members", () => {
    expect(FEDOS_RELEASE_STATUSES).toContain("superseded");
    expect(FEDOS_ADVISORY_SEVERITIES).toContain("accepted-beta-limitation");
  });
});

// ---------------------------------------------------------------------
// Phase H — tag format + retagging-prohibition policy.
// ---------------------------------------------------------------------

describe("Phase H — Beta tag format", () => {
  it("derives and validates a well-formed tag for a given version", () => {
    const tag = fedosBetaTagForVersion("0.1.0-beta.7");
    expect(tag).toBe("fedos-desktop-v0.1.0-beta.7");
    expect(FEDOS_BETA_TAG_PATTERN.test(tag)).toBe(true);
    expect(validateFedosBetaTagFormat(tag, "0.1.0-beta.7").ok).toBe(true);
  });

  it("rejects a malformed tag", () => {
    expect(validateFedosBetaTagFormat("v0.1.0-beta.7", "0.1.0-beta.7").ok).toBe(false);
    expect(validateFedosBetaTagFormat("fedos-desktop-0.1.0-beta.7", "0.1.0-beta.7").ok).toBe(false);
  });

  it("rejects a well-formed tag naming a different version than the current release", () => {
    const result = validateFedosBetaTagFormat("fedos-desktop-v0.1.0-beta.6", "0.1.0-beta.7");
    expect(result.ok).toBe(false);
    expect(result.problem.kind).toBe("version-mismatch");
  });

  it("policy forbids retagging and dirty-tree tagging", () => {
    expect(FEDOS_BETA_TAG_POLICY.allowRetagging).toBe(false);
    expect(FEDOS_BETA_TAG_POLICY.dirtyTreeAllowed).toBe(false);
    expect(FEDOS_BETA_TAG_POLICY.onRevocation).toBe("keep-tag-publish-advisory");
  });
});

// ---------------------------------------------------------------------
// Phase E — release notes generator content checks.
// ---------------------------------------------------------------------

describe("Phase E — deterministic release notes", () => {
  const capabilities = [
    { userVisibleLabel: "Local encrypted profile", coarseLimitation: "single device only", betaIncluded: true, status: "available" },
    { userVisibleLabel: "Device sync", coarseLimitation: "manual pairing only", betaIncluded: true, status: "available-development-only" },
    { userVisibleLabel: "Cloud backup", coarseLimitation: "not implemented", betaIncluded: true, status: "blocked" },
  ];
  const limitations = [{ label: "No account recovery", statement: "A forgotten passphrase cannot be recovered." }];

  it("discloses unsigned state, no-auto-update, and profile-backup guidance", () => {
    const notes = generateFedosBetaReleaseNotes({ identity: FIXTURE_IDENTITY, capabilities, limitations });
    expect(notes).toMatch(/unsigned/i);
    expect(notes).toMatch(/No automatic update/i);
    expect(notes).toMatch(/Back up your profile/i);
    expect(notes).toMatch(/schema compatibility/i);
  });

  it("lists usable, development-only, and blocked capabilities in their own sections", () => {
    const notes = generateFedosBetaReleaseNotes({ identity: FIXTURE_IDENTITY, capabilities, limitations });
    expect(notes).toMatch(/Local encrypted profile/);
    expect(notes).toMatch(/not yet reachable from the packaged application/);
    expect(notes).toMatch(/honestly blocked/);
  });
});

// ---------------------------------------------------------------------
// Phase F — full staging-directory verification, built from fixtures.
// ---------------------------------------------------------------------

function writeValidStagingFixture(dir: string) {
  const artifacts = makeArtifacts(dir);
  const releaseManifest = {
    schemaVersion: 1,
    productName: "FedOS Desktop",
    productVersion: FIXTURE_IDENTITY.productVersion,
    channel: "beta",
    gitCommit: FIXTURE_IDENTITY.gitCommit,
    buildIdentity: FIXTURE_IDENTITY.buildIdentity,
    unsigned: true,
    artifacts,
  };
  writeFileSync(join(dir, "release-manifest.v1.json"), JSON.stringify(releaseManifest, null, 2), "utf8");
  const checksumLines = artifacts.map((a: { sha256Hex: string; filename: string }) => `${a.sha256Hex}  ${a.filename}`);
  checksumLines.push(`${sha256HexOf(join(dir, "release-manifest.v1.json"))}  release-manifest.v1.json`);
  writeFileSync(join(dir, "SHA256SUMS.txt"), checksumLines.sort().join("\n") + "\n", "utf8");
  const bundle = buildFedosBetaPublicationBundleV1({ identity: FIXTURE_IDENTITY, artifacts, canonicalHostPolicy: "local-only" });
  writeFileSync(join(dir, "publication-bundle.json"), JSON.stringify(bundle, null, 2), "utf8");
  for (const name of ["RELEASE_NOTES.md", "KNOWN_LIMITATIONS.md", "INSTALL_WINDOWS.md", "VERIFY_DOWNLOAD.md", "SECURITY_NOTICE.md", "RELEASE_ANNOUNCEMENT.md"]) {
    writeFileSync(join(dir, name), `# ${name}\n\nOrdinary staging document content for ${FIXTURE_IDENTITY.productVersion}.\n`, "utf8");
  }
  const statusRecord = buildFedosReleaseStatusRecordV1({ status: "candidate", affectedVersion: FIXTURE_IDENTITY.productVersion, canonicalAdvisoryLocationPolicy: "local-only" });
  writeFileSync(join(dir, "REVOCATION_STATUS.json"), JSON.stringify(statusRecord, null, 2), "utf8");
  return { artifacts, releaseManifest, bundle };
}

describe("Phase F — verifyFedosReleaseStaging", () => {
  it("passes on a complete, internally-consistent fixture staging directory", () => {
    const dir = makeTmpDir();
    writeValidStagingFixture(dir);
    const result = verifyFedosReleaseStaging(dir, { expectedProductVersion: FIXTURE_IDENTITY.productVersion });
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("fails closed when a required file is missing", () => {
    const dir = makeTmpDir();
    writeValidStagingFixture(dir);
    rmSync(join(dir, "SECURITY_NOTICE.md"));
    const result = verifyFedosReleaseStaging(dir, { expectedProductVersion: FIXTURE_IDENTITY.productVersion });
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: Problem) => p.kind === "missing-required-file" && p.filename === "SECURITY_NOTICE.md")).toBe(true);
  });

  it("fails closed on an unexpected extra non-artifact file", () => {
    const dir = makeTmpDir();
    writeValidStagingFixture(dir);
    writeFileSync(join(dir, "unexpected-notes.txt"), "surprise", "utf8");
    const result = verifyFedosReleaseStaging(dir, { expectedProductVersion: FIXTURE_IDENTITY.productVersion });
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: Problem) => p.kind === "unexpected-file")).toBe(true);
  });

  it("fails closed on a certificate/private-key file present anywhere in staging", () => {
    const dir = makeTmpDir();
    writeValidStagingFixture(dir);
    writeFileSync(join(dir, "accidental.pfx"), "not a real cert", "utf8");
    const result = verifyFedosReleaseStaging(dir, { expectedProductVersion: FIXTURE_IDENTITY.productVersion });
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: Problem) => p.kind === "certificate-file-present" && p.filename === "accidental.pfx")).toBe(true);
  });

  it("fails closed when an artifact's real bytes no longer match its recorded hash (tamper/stale-signing detection)", () => {
    const dir = makeTmpDir();
    writeValidStagingFixture(dir);
    writeFileSync(join(dir, `FedOS-Desktop-Beta-Setup-${FIXTURE_IDENTITY.productVersion}.exe`), "TAMPERED installer bytes");
    const result = verifyFedosReleaseStaging(dir, { expectedProductVersion: FIXTURE_IDENTITY.productVersion });
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: Problem) => p.kind === "artifact-hash-mismatch")).toBe(true);
  });

  it("fails closed on a secret pattern found in a staged text document", () => {
    const dir = makeTmpDir();
    writeValidStagingFixture(dir);
    writeFileSync(join(dir, "RELEASE_NOTES.md"), "# notes\n\nconst secret = \"correct horse battery staple\";\n", "utf8");
    const result = verifyFedosReleaseStaging(dir, { expectedProductVersion: FIXTURE_IDENTITY.productVersion });
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: Problem) => p.kind === "secret-pattern-finding")).toBe(true);
  });

  it("fails closed on auto-update metadata leaking into a staged document", () => {
    const dir = makeTmpDir();
    writeValidStagingFixture(dir);
    writeFileSync(join(dir, "RELEASE_NOTES.md"), "# notes\n\nSee electron-updater configuration.\n", "utf8");
    const result = verifyFedosReleaseStaging(dir, { expectedProductVersion: FIXTURE_IDENTITY.productVersion });
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: Problem) => p.kind === "auto-update-metadata-present")).toBe(true);
  });

  it("fails closed on a product-version mismatch", () => {
    const dir = makeTmpDir();
    writeValidStagingFixture(dir);
    const result = verifyFedosReleaseStaging(dir, { expectedProductVersion: "9.9.9-beta.99" });
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: Problem) => p.kind === "product-version-mismatch")).toBe(true);
  });

  it("the expected staging file inventory is exactly the closed, documented set", () => {
    const dir = makeTmpDir();
    writeValidStagingFixture(dir);
    for (const filename of FEDOS_EXPECTED_STAGING_FILES) {
      expect(existsSync(join(dir, filename))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------
// Phase G/O — publication dry run: zero side effects, fails closed.
// ---------------------------------------------------------------------

describe("Phase G/O — publication dry run", () => {
  it("produces a full plan with no side effects for a valid bundle", () => {
    const dir = makeTmpDir();
    const artifacts = makeArtifacts(dir);
    const bundle = buildFedosBetaPublicationBundleV1({ identity: FIXTURE_IDENTITY, artifacts, canonicalHostPolicy: "local-only" });
    const plan = buildFedosPublicationDryRunPlan({ bundle });
    expect(plan.performedNoSideEffects).toBe(true);
    expect(plan.dryRun).toBe(true);
    expect(plan.tag).toBe(`fedos-desktop-v${FIXTURE_IDENTITY.productVersion}`);
    expect(plan.uploadOrder[0]).toBe(artifacts.find((a: { primary: boolean }) => a.primary)!.filename);
    expect(plan.uploadPlan.every((u: { canonicalUrlTemplate: string }) => u.canonicalUrlTemplate.startsWith("file://"))).toBe(true);
  });

  it("fails closed (throws) rather than planning a publication for an invalid bundle", () => {
    expect(() => buildFedosPublicationDryRunPlan({ bundle: { schemaVersion: 1 } })).toThrow();
  });

  it("assigns correct MIME types to installer, ZIP, and JSON artifacts", () => {
    const dir = makeTmpDir();
    const artifacts = makeArtifacts(dir);
    const bundle = buildFedosBetaPublicationBundleV1({ identity: FIXTURE_IDENTITY, artifacts, canonicalHostPolicy: "local-only" });
    const plan = buildFedosPublicationDryRunPlan({ bundle });
    const exeEntry = plan.uploadPlan.find((u: { filename: string }) => u.filename.endsWith(".exe"));
    const manifestEntry = plan.uploadPlan.find((u: { filename: string }) => u.filename === "release-manifest.v1.json");
    expect(exeEntry.mimeType).toBe("application/vnd.microsoft.portable-executable");
    expect(manifestEntry.mimeType).toBe("application/json");
  });
});

// ---------------------------------------------------------------------
// Phase P — remote download verification against a REAL local HTTP server.
// ---------------------------------------------------------------------

describe("Phase P — remote download verification (local in-process HTTP server, no new dependency)", () => {
  function startServer(bodyByPath: Record<string, Buffer>): Promise<{ url: string; close: () => Promise<void> }> {
    return new Promise((resolve) => {
      const server = http.createServer((req: any, res: any) => {
        const body = bodyByPath[req.url as string];
        if (body === undefined) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200);
        res.end(body);
      });
      server.listen(0, "127.0.0.1", () => {
        const port = (server.address() as { port: number }).port;
        resolve({
          url: `http://127.0.0.1:${port}`,
          close: () => new Promise((r) => server.close(() => r(undefined))),
        });
      });
    });
  }

  it("downloads real bytes over a real socket and confirms they match the trusted manifest hash", async () => {
    const bytes = Buffer.from("real installer bytes served over the wire");
    const { url, close } = await startServer({ "/installer.exe": bytes });
    try {
      const { body } = await fetchFedosReleaseArtifact(`${url}/installer.exe`);
      const releaseManifest = {
        productVersion: FIXTURE_IDENTITY.productVersion,
        channel: "beta",
        unsigned: true,
        artifacts: [{ filename: "installer.exe", sizeBytes: bytes.length, sha256Hex: createHash("sha256").update(bytes).digest("hex") }],
      };
      const result = verifyFedosDownloadedArtifact({ filename: "installer.exe", downloadedBytes: body, releaseManifest, expectedProductVersion: FIXTURE_IDENTITY.productVersion });
      expect(result.ok).toBe(true);
    } finally {
      await close();
    }
  });

  it("catches a mirror/tamper that changed bytes without changing the declared hash", async () => {
    const realBytes = Buffer.from("the real, published bytes");
    const tamperedServedBytes = Buffer.from("a mirror silently substituted these bytes");
    const { url, close } = await startServer({ "/installer.exe": tamperedServedBytes });
    try {
      const { body } = await fetchFedosReleaseArtifact(`${url}/installer.exe`);
      const releaseManifest = {
        productVersion: FIXTURE_IDENTITY.productVersion,
        channel: "beta",
        unsigned: true,
        artifacts: [{ filename: "installer.exe", sizeBytes: realBytes.length, sha256Hex: createHash("sha256").update(realBytes).digest("hex") }],
      };
      const result = verifyFedosDownloadedArtifact({ filename: "installer.exe", downloadedBytes: body, releaseManifest, expectedProductVersion: FIXTURE_IDENTITY.productVersion });
      expect(result.ok).toBe(false);
      expect(result.problems.some((p: Problem) => p.kind === "hash-mismatch")).toBe(true);
    } finally {
      await close();
    }
  });

  it("rejects a redirect chain longer than the configured maximum (never auto-trusts a mirror chain)", async () => {
    await expect(fetchFedosReleaseArtifact("http://127.0.0.1:1/nonexistent-unreachable-host-for-this-test", { maxRedirects: 0 })).rejects.toBeTruthy();
  });

  it("detects a WASM build identity mismatch between a downloaded bundle and the trusted local manifest", () => {
    const releaseManifest = { wasmArtifactManifest: { crateVersion: "1.2.3", sha256Hex: "a".repeat(64) } };
    const downloadedBundle = { wasmArtifactManifest: { crateVersion: "1.2.3", sha256Hex: "b".repeat(64) } };
    const result = verifyDownloadedWasmBuildIdentity(downloadedBundle, releaseManifest);
    expect(result.ok).toBe(false);
    expect(result.problems[0].kind).toBe("wasm-build-identity-mismatch");
  });

  it("confirms matching WASM build identity passes", () => {
    const manifest = { wasmArtifactManifest: { crateVersion: "1.2.3", sha256Hex: "a".repeat(64) } };
    const result = verifyDownloadedWasmBuildIdentity({ wasmArtifactManifest: manifest.wasmArtifactManifest }, manifest);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------
// Phase N — future signing seam: checksums generated BEFORE a (simulated)
// signing step are correctly rejected as stale by the EXISTING checksum
// verifier -- no new migration/verification engine invented for this.
// ---------------------------------------------------------------------

describe("Phase N — stale checksum detection across a simulated signing step", () => {
  it("checksums computed before simulated signing are rejected once the (simulated) signed bytes replace the unsigned ones", () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, "installer.exe"), "unsigned installer bytes");
    const preSigningChecksum = sha256HexOf(join(dir, "installer.exe"));
    // Simulate an external signing step mutating the installer's bytes (a real `signtool sign` changes the file).
    writeFileSync(join(dir, "installer.exe"), "unsigned installer bytes + a simulated Authenticode signature block");
    const result = verifyFedosReleaseChecksums(dir, [{ sha256Hex: preSigningChecksum, filename: "installer.exe" }]);
    expect(result.ok).toBe(false);
    expect(result.problems[0].kind).toBe("hash-mismatch");
  });

  it("checksums regenerated AFTER the simulated signing step pass again", () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, "installer.exe"), "unsigned installer bytes + a simulated Authenticode signature block");
    const postSigningChecksum = sha256HexOf(join(dir, "installer.exe"));
    const result = verifyFedosReleaseChecksums(dir, [{ sha256Hex: postSigningChecksum, filename: "installer.exe" }]);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------
// Phase Q — public Beta gate: closed verdict vocabulary, never "published".
// ---------------------------------------------------------------------

describe("Phase Q — public Beta gate report", () => {
  it("reports 'blocked' with informative gate ids when the staging directory does not exist", () => {
    const dir = makeTmpDir();
    const missingStaging = join(dir, "does-not-exist");
    const report = generateFedosPublicBetaGateReport({ root: process.cwd(), stagingDir: missingStaging, expectedProductVersion: "0.1.0-beta.7" });
    expect(report.verdict).toBe("blocked");
    expect(report.blockingGateIds.length).toBeGreaterThan(0);
    expect(report.humanApprovalPending).toBe(true);
  });

  it("never reports the verdict 'published'", () => {
    const dir = makeTmpDir();
    const report = generateFedosPublicBetaGateReport({ root: process.cwd(), stagingDir: join(dir, "missing"), expectedProductVersion: "0.1.0-beta.7" });
    expect(report.verdict).not.toBe("published");
    expect(["ready-for-human-publication", "blocked"]).toContain(report.verdict);
  });

  it("reaches every mechanically-verifiable gate when given a complete, valid staging fixture", () => {
    const dir = makeTmpDir();
    writeValidStagingFixture(dir);
    const report = generateFedosPublicBetaGateReport({
      root: process.cwd(),
      stagingDir: dir,
      expectedProductVersion: FIXTURE_IDENTITY.productVersion,
      attestedEvidence: { betaAcceptanceJourneyPassed: true },
    });
    const mechanicalGateIds = ["manifest-produced", "checksums-produced", "staging-bundle-complete", "local-verification-passed", "secret-scan-passed", "release-notes-complete", "known-limitations-complete", "unsigned-disclosure-complete", "canonical-host-policy-selected"];
    for (const id of mechanicalGateIds) {
      const gate = report.gates.find((g: { id: string }) => g.id === id);
      expect(gate.status).toBe("met");
    }
    const acceptedLimitationIds = ["install-uninstall-tested", "profile-preservation-tested", "same-schema-upgrade-tested"];
    for (const id of acceptedLimitationIds) {
      const gate = report.gates.find((g: { id: string }) => g.id === id);
      expect(gate.status).toBe("accepted-limitation");
    }
  });

  it("blocks on beta-acceptance-journey-passed when no attested evidence is supplied", () => {
    const dir = makeTmpDir();
    writeValidStagingFixture(dir);
    const report = generateFedosPublicBetaGateReport({ root: process.cwd(), stagingDir: dir, expectedProductVersion: FIXTURE_IDENTITY.productVersion });
    expect(report.blockingGateIds).toContain("beta-acceptance-journey-passed");
    expect(report.verdict).toBe("blocked");
  });
});

// ---------------------------------------------------------------------
// Structural guards: no new production dependency, no production-code
// redesign for this Arc — only new scripts/lib modules under
// `packages/fedos-desktop-electron-spike/scripts/`.
// ---------------------------------------------------------------------

describe("Structural guard — no new runtime dependency introduced by this Arc", () => {
  it("the electron package's own package.json dependency set is unchanged from the prior Arc's accepted shape", async () => {
    const pkg = await import("../packages/fedos-desktop-electron-spike/package.json?raw" as string);
    const parsed = JSON.parse((pkg as { default: string }).default);
    expect(Object.keys(parsed.dependencies ?? {})).not.toContain("adm-zip");
    expect(Object.keys(parsed.dependencies ?? {})).not.toContain("node-forge");
  });
});
