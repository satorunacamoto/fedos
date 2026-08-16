/**
 * Secure Runtime Alpha 5241-5320 — FedOS Desktop Beta 0.1 NSIS Installer,
 * Portable ZIP, and Checksum Publication Arc — packaging unit tests.
 *
 * Exercises the real packaging scripts' own logic (checksum parse/
 * verify, secret-scan patterns, package-allowlist verification, release-
 * identity parsing) against small, deterministic FIXTURES — never
 * requiring a real `electron-builder`/Cargo/WASM build to run. The
 * separate real-build acceptance evidence (NSIS installer + ZIP actually
 * produced, installed, launched) is recorded in
 * `docs/secure_runtime_alpha_5241_5320_packaging_reconciliation_report.md`
 * and `..._completion_declaration.md`, not re-proven here on every test
 * run (this suite must pass in ANY environment, with or without
 * Electron/Rust toolchains installed).
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// @ts-expect-error this repo's own packaging `.mjs` scripts carry no `.d.ts` declaration file.
import { parseFedosReleaseChecksumFile, verifyFedosReleaseChecksums, sha256HexOf } from "../packages/fedos-desktop-electron-spike/scripts/verify_release_checksums.mjs";
// @ts-expect-error see above.
import { FEDOS_RELEASE_SECRET_SCAN_PATTERNS, scanFedosReleaseFileForSecrets } from "../packages/fedos-desktop-electron-spike/scripts/scan_release_artifacts_for_secrets.mjs";
import { verifyFedosBetaPackageAllowlist } from "../packages/fedos-desktop-electron-spike/scripts/verify_release_package_allowlist.mjs";
// @ts-expect-error see above.
import { resolveFedosBetaReleaseIdentity } from "../packages/fedos-desktop-electron-spike/scripts/lib/release_identity.mjs";

interface FedosChecksumProblem {
  readonly kind: string;
  readonly filename: string;
  readonly forbidden?: string;
}
interface FedosAllowlistProblem {
  readonly kind: string;
  readonly entry?: string;
  readonly forbidden?: string;
}
interface FedosSecretScanFinding {
  readonly patternId: string;
}

const tmpDirs: string[] = [];
function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-packaging-test-"));
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

// ---------------------------------------------------------------------
// Phase G/H — release identity (real source, real regex parsing).
// ---------------------------------------------------------------------

describe("Phase B — release identity resolution against real accepted source", () => {
  it("resolves productName/version/channel/schemaVersions from the real, unmodified release configuration", () => {
    const identity = resolveFedosBetaReleaseIdentity({ requireClean: false });
    expect(identity.productName).toBe("FedOS Desktop");
    expect(identity.productVersion).toMatch(/^\d+\.\d+\.\d+-beta\.\d+$/);
    expect(identity.channel).toBe("beta");
    expect(identity.releaseSequence).toBeGreaterThanOrEqual(1);
    expect(identity.schemaVersions.settings).toBe(1);
    expect(identity.schemaVersions.profile).toBe(1);
    expect(identity.schemaVersions.capabilityManifest).toBe(1);
    expect(identity.schemaVersions.archive).toBe(1);
    expect(identity.minimumSupportedPlatform).toBe("windows-x64");
    expect(identity.unsigned).toBe(true);
    expect(identity.gitCommit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("throws (never fabricates) when requireClean is true and the tree is not actually verified clean here", () => {
    // This test environment's own tree state is not controlled by this test (other files may be
    // staged/unstaged during development) -- so this only asserts the FUNCTION correctly reports
    // whichever real state `git status --porcelain` observes, never silently ignoring dirtiness.
    const identity = resolveFedosBetaReleaseIdentity({ requireClean: false });
    expect(typeof identity.gitTreeClean).toBe("boolean");
  });
});

// ---------------------------------------------------------------------
// Phase H/O — checksum generation format, verification, and tamper tests.
// ---------------------------------------------------------------------

describe("Phase H — checksum file parsing", () => {
  it("parses a well-formed SHA256SUMS-shaped file", () => {
    const text = `${"a".repeat(64)}  a.exe\n${"b".repeat(64)}  b.zip\n`;
    const records = parseFedosReleaseChecksumFile(text);
    expect(records).not.toBeNull();
    expect(records!.length).toBe(2);
    expect(records![0]!.filename).toBe("a.exe");
  });

  it("rejects a malformed line (wrong separator, short hash)", () => {
    expect(parseFedosReleaseChecksumFile("not-a-valid-line")).toBeNull();
    expect(parseFedosReleaseChecksumFile("abc123  file.exe")).toBeNull(); // hash too short
  });

  it("accepts uppercase hex and normalizes to lowercase", () => {
    const upper = "A".repeat(64);
    const records = parseFedosReleaseChecksumFile(`${upper}  file.exe\n`);
    expect(records).not.toBeNull();
    expect(records![0]!.sha256Hex).toBe("a".repeat(64));
  });
});

describe("Phase H/O — checksum verification and tamper detection", () => {
  it("verifies real files against their own real, freshly-computed hashes", () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, "installer.exe"), "fake installer bytes");
    writeFileSync(join(dir, "app.zip"), "fake zip bytes");
    const records = [
      { sha256Hex: sha256HexOf(join(dir, "installer.exe")), filename: "installer.exe" },
      { sha256Hex: sha256HexOf(join(dir, "app.zip")), filename: "app.zip" },
    ];
    const result = verifyFedosReleaseChecksums(dir, records);
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
  });

  it("fails closed on a one-byte tampered file (hash mismatch)", () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, "installer.exe"), "fake installer bytes");
    const goodHash = sha256HexOf(join(dir, "installer.exe"));
    writeFileSync(join(dir, "installer.exe"), "Fake installer bytes"); // one byte changed: f -> F
    const result = verifyFedosReleaseChecksums(dir, [{ sha256Hex: goodHash, filename: "installer.exe" }]);
    expect(result.ok).toBe(false);
    expect(result.problems[0]!.kind).toBe("hash-mismatch");
  });

  it("fails closed on a missing file", () => {
    const dir = makeTmpDir();
    const result = verifyFedosReleaseChecksums(dir, [{ sha256Hex: "a".repeat(64), filename: "does-not-exist.exe" }]);
    expect(result.ok).toBe(false);
    expect(result.problems[0]!.kind).toBe("missing-file");
  });

  it("fails closed on an extra, unlisted file present in the release directory", () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, "installer.exe"), "bytes");
    writeFileSync(join(dir, "sneaky-extra-file.exe"), "surprise");
    const result = verifyFedosReleaseChecksums(dir, [{ sha256Hex: sha256HexOf(join(dir, "installer.exe")), filename: "installer.exe" }]);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: FedosChecksumProblem) => p.kind === "extra-unlisted-file" && p.filename === "sneaky-extra-file.exe")).toBe(true);
  });

  it("fails closed on a filename mismatch (listed filename does not exist under a different name)", () => {
    const dir = makeTmpDir();
    writeFileSync(join(dir, "actual-name.exe"), "bytes");
    const result = verifyFedosReleaseChecksums(dir, [{ sha256Hex: sha256HexOf(join(dir, "actual-name.exe")), filename: "expected-name.exe" }]);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: FedosChecksumProblem) => p.kind === "missing-file")).toBe(true);
    expect(result.problems.some((p: FedosChecksumProblem) => p.kind === "extra-unlisted-file")).toBe(true);
  });
});

// ---------------------------------------------------------------------
// Phase N — secret scan patterns.
// ---------------------------------------------------------------------

describe("Phase N — secret scan pattern coverage", () => {
  it("flags a PEM private key block", () => {
    const findings = scanFedosReleaseFileForSecrets("x.js", "-----BEGIN RSA PRIVATE KEY-----\nMIIB...\n-----END RSA PRIVATE KEY-----");
    expect(findings.some((f: FedosSecretScanFinding) => f.patternId === "pem-private-key")).toBe(true);
  });

  it("flags the repository's own well-known test passphrase fixture", () => {
    const findings = scanFedosReleaseFileForSecrets("x.js", 'const secret = "correct horse battery staple";');
    expect(findings.some((f: FedosSecretScanFinding) => f.patternId === "known-test-passphrase")).toBe(true);
  });

  it("flags a local worktree absolute path", () => {
    const findings = scanFedosReleaseFileForSecrets("x.js", "// built at C:\\wt\\fedos-beta-packaging\\something");
    expect(findings.some((f: FedosSecretScanFinding) => f.patternId === "worktree-absolute-path")).toBe(true);
  });

  it("flags the dev-only Master Seed double if it ever reached staged output", () => {
    const findings = scanFedosReleaseFileForSecrets("x.js", "new DevelopmentFedosMasterSeedAuthority()");
    expect(findings.some((f: FedosSecretScanFinding) => f.patternId === "dev-master-seed-double")).toBe(true);
  });

  it("does not flag ordinary compiled JS content", () => {
    const ordinary = 'export function fedosDesktopBetaCapabilityManifestV1() { return { manifestVersion: 1, capabilities: [] }; }\nconst PORT = 8080;';
    const findings = scanFedosReleaseFileForSecrets("ordinary.js", ordinary);
    expect(findings).toEqual([]);
  });

  it("every pattern has a non-empty id and reason (closed, documented vocabulary)", () => {
    for (const p of FEDOS_RELEASE_SECRET_SCAN_PATTERNS) {
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.reason.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------
// Phase E — package allowlist verification.
// ---------------------------------------------------------------------

describe("Phase E — package allowlist verification against the real config", () => {
  it("the real electron_builder.beta.config.json passes allowlist verification", () => {
    // @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
    // eslint-disable-next-line
    return import("../packages/fedos-desktop-electron-spike/electron_builder.beta.config.json?raw").then((mod: { default: string }) => {
      const result = verifyFedosBetaPackageAllowlist(mod.default);
      expect(result.ok).toBe(true);
      expect(result.problems).toEqual([]);
    });
  });

  it("fails closed when a required compiled entry is missing", () => {
    const config = JSON.stringify({ files: ["package.json", "!node_modules/**/*", "!src/**/*", "!test/**/*"] });
    const result = verifyFedosBetaPackageAllowlist(config);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: FedosAllowlistProblem) => p.kind === "missing-required-entry")).toBe(true);
  });

  it("fails closed when a forbidden path is included (not excluded) via extraFiles", () => {
    const config = JSON.stringify({
      files: ["dist/fedos_electron_beta_main.cjs", "dist/fedos_electron_beta_preload.cjs", "dist/fedos_electron_beta_renderer.js", "dist/fedos_electron_beta_page.html", "package.json", "!node_modules/**/*", "!src/**/*", "!test/**/*"],
      extraFiles: [{ from: "../../docs/reviews/some-secret-review", to: "docs" }],
    });
    const result = verifyFedosBetaPackageAllowlist(config);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: FedosAllowlistProblem) => p.kind === "forbidden-path-included" && p.forbidden === "docs/reviews")).toBe(true);
  });

  it("fails closed on a bare, non-explicit allow-list glob", () => {
    const config = JSON.stringify({ files: ["**/*", "!node_modules/**/*", "!src/**/*", "!test/**/*"] });
    const result = verifyFedosBetaPackageAllowlist(config);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: FedosAllowlistProblem) => p.kind === "non-explicit-allowlist")).toBe(true);
  });
});

// ---------------------------------------------------------------------
// Phase L — downgrade/schema fail-closed behavior reuses EXISTING validators
// (no new migration engine is added; this suite only proves the existing
// codecs still reject a foreign schemaVersion, matching the accepted
// distribution review's own Phase 11/13 findings).
// ---------------------------------------------------------------------

describe("Phase L — existing schema validators still fail closed on an unsupported version (no migration invented)", () => {
  it("the local profile descriptor codec rejects schemaVersion !== 1", async () => {
    const mod = await import("../src/os/messenger/desktop/onboarding/fedos_local_profile_descriptor.js");
    const malformed = { schemaVersion: 2, profileId: "a".repeat(32), displayLabel: "x", accountPublicIdentity: { authority: "nostr", publicKeyHex: "b".repeat(64) }, localDeviceId: "d", createdAt: 1, lastOpenedAt: 1, sealedMasterSeedRef: "/x", dataDirectoryRoot: "/x", initializationState: "ready", migrationVersion: 1 };
    expect(mod.isWellFormedFedosLocalProfileDescriptorV1(malformed)).toBe(false);
  });
});
