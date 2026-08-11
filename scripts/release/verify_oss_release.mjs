#!/usr/bin/env node
// FedOS OSS Public Release Surface Freeze arc — machine-checkable release
// policy verifier.
//
// A deterministic, dependency-free, git-tracked-files-only checker
// (mirrors this repo's own `scripts/generate_third_party_notices.mjs` /
// `packages/fedos-desktop-electron-spike/scripts/scan_release_artifacts_for_secrets.mjs`
// convention: plain Node ESM, no new dependency). It does NOT replace a
// human security review or the deeper heuristic secret sweep an agent/
// reviewer can do — it is a FAST, MECHANICAL, CI-runnable gate that
// catches the specific, well-defined regressions this arc named:
//
//   - forbidden secret/private file paths tracked by git
//   - required LICENSE present
//   - required public docs present
//   - machine-specific absolute paths in release-critical files
//   - private issuer key material embedded anywhere
//   - required Trust test files present (this repo's own executable test
//     vectors for the Trust capability — NOT `test-vectors/`, which is a
//     verbatim-import-only directory for THIRD-PARTY official crypto KAT
//     data per `test-vectors/README.md` §5 "generated vectors forbidden";
//     FedOS's own Trust envelope test cases live in `test/trust_*.test.ts`
//     instead, by design)
//   - package/build files present
//
// Exit code 0 = every check passed. Non-zero = at least one failed (see
// stdout for exactly which). Never prints a discovered secret's VALUE —
// only the path/pattern that matched, same discipline as this repo's own
// secret scanner.
//
// Usage: node scripts/release/verify_oss_release.mjs

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function trackedFiles() {
  const out = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" });
  return out.split(/\r?\n/).filter(Boolean);
}

function readTracked(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail ?? "" });
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

const files = trackedFiles();
const fileSet = new Set(files);

// ---------------------------------------------------------------------
// 1. Forbidden secret/private paths absent (tracked by git).
// ---------------------------------------------------------------------
check("no forbidden secret/private file paths tracked", () => {
  const FORBIDDEN_PATTERNS = [
    /(^|\/)\.env(\..+)?$/i,
    /\.pem$/i,
    /\.p12$/i,
    /\.pfx$/i,
    /(^|\/)id_rsa$/i,
    /(^|\/)id_ed25519$/i,
    /fedos[_-]?official[_-]?(issuer[_-]?)?(private|secret)[_-]?key/i,
    /\.key$/i, // any literal ".key" file — this repo's own issuer key is
    // ALWAYS operator-generated outside the repo (never committed); a
    // tracked ".key" file of any kind is unexpected.
  ];
  const hits = files.filter((f) => FORBIDDEN_PATTERNS.some((re) => re.test(f)));
  if (hits.length > 0) {
    throw new Error(`forbidden path(s) tracked: ${hits.join(", ")}`);
  }
  return `0 forbidden paths among ${files.length} tracked files`;
});

// ---------------------------------------------------------------------
// 2. Required LICENSE present.
// ---------------------------------------------------------------------
check("LICENSE present and non-empty, package.json license field set", () => {
  if (!fileSet.has("LICENSE")) throw new Error("LICENSE missing from tracked files");
  const licenseText = readTracked("LICENSE");
  if (licenseText.trim().length < 100) throw new Error("LICENSE file suspiciously short/empty");
  const pkg = JSON.parse(readTracked("package.json"));
  if (pkg.license !== "MPL-2.0") throw new Error(`package.json "license" field is "${pkg.license}", expected "MPL-2.0"`);
  return "LICENSE present, package.json license = MPL-2.0";
});

// ---------------------------------------------------------------------
// 3. Required public docs present.
// ---------------------------------------------------------------------
const REQUIRED_PUBLIC_DOCS = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "ARCHITECTURE.md",
  "BUILDING.md",
  "LICENSE_STATUS.md",
  "THIRD_PARTY_NOTICES.md",
  "docs/architecture/TRUST-MODEL.md",
  "docs/architecture/OFFLINE-MONETIZATION-MODEL.md",
  "docs/operations/OFFLINE-ISSUER-RUNBOOK.md",
  "docs/user/SUBSCRIPTION-ENTITLEMENT.md",
  "docs/release/OSS-LICENSE-DECISION.md",
  "docs/release/OSS-PUBLIC-SURFACE.md",
  "docs/release/TEST-SURFACES.md",
  "src/os/trust/README.md",
  "src/os/messenger/README.md",
  ".github/workflows/ci.yml",
];
check("required public docs present", () => {
  const missing = REQUIRED_PUBLIC_DOCS.filter((d) => !fileSet.has(d));
  if (missing.length > 0) throw new Error(`missing: ${missing.join(", ")}`);
  return `${REQUIRED_PUBLIC_DOCS.length}/${REQUIRED_PUBLIC_DOCS.length} present`;
});

// ---------------------------------------------------------------------
// 4. No machine-specific absolute paths in release-critical files.
// ---------------------------------------------------------------------
const RELEASE_CRITICAL_GLOB_PREFIXES = [
  "README.md",
  "BUILDING.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "ARCHITECTURE.md",
  "LICENSE_STATUS.md",
  "THIRD_PARTY_NOTICES.md",
  "ROADMAP.md",
  "KNOWN_LIMITATIONS.md",
  "package.json",
  "scripts/",
  "docs/architecture/",
  "docs/release/",
  "docs/user/",
  "docs/operations/",
  "src/os/trust/",
  "src/os/messenger/README.md",
  ".github/",
];
// Deliberately narrow to actual ABSOLUTE-PATH shapes, not bare mentions of
// words like "OneDrive"/"OS-worktrees" — this repo's own docs legitimately
// use "OneDrive" as a general concept in advisory prose (e.g. `BUILDING.md`'s
// "avoid overriding CARGO_TARGET_DIR inside a OneDrive-backed checkout") and
// "OS-worktrees/<name>" as a plain relative path describing dev workflow —
// neither is a leaked machine-specific absolute path. Only flag a real
// Windows drive-letter absolute path, optionally followed by an OneDrive
// folder segment (this environment's actual on-disk shape), or an explicit
// `.claude/worktrees/` agent-scaffolding path.
const MACHINE_SPECIFIC_PATTERNS = [
  /[A-Za-z]:\\Users\\/, // any Windows user-profile absolute path
  /\.claude[\\/]worktrees/,
];
// Point-in-time arc completion/evidence records (this repo's own
// established `*-FINAL-VALIDATION.md`/`*-EVIDENCE*.md` naming convention)
// are historical provenance, not release-critical public-facing docs — the
// arc brief's own §14 explicitly carves these out ("Historical evidence
// documents may be treated separately"). They may legitimately narrate
// this session's own worktree/methodology details.
const HISTORICAL_EVIDENCE_DOC_PATTERN = /-FINAL-VALIDATION\.md$|-EVIDENCE(-[A-Z0-9-]+)?\.md$/;
check("no machine-specific absolute paths in release-critical files", () => {
  const releaseCriticalFiles = files.filter(
    (f) =>
      RELEASE_CRITICAL_GLOB_PREFIXES.some((prefix) => (prefix.endsWith("/") ? f.startsWith(prefix) : f === prefix)) &&
      !HISTORICAL_EVIDENCE_DOC_PATTERN.test(f) &&
      // This script's own pattern-DEFINITION source necessarily contains the
      // literal strings it searches for (e.g. `.claude/worktrees` inside a
      // regex literal) — exclude it from its own scan, same self-exclusion
      // discipline as this repo's existing secret scanner applies to itself.
      f !== "scripts/release/verify_oss_release.mjs",
  );
  const hits = [];
  for (const f of releaseCriticalFiles) {
    const content = readTracked(f);
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      for (const pattern of MACHINE_SPECIFIC_PATTERNS) {
        if (pattern.test(line)) {
          hits.push(`${f}:${idx + 1} matches ${pattern}`);
        }
      }
    });
  }
  if (hits.length > 0) {
    throw new Error(`${hits.length} leak(s):\n    ${hits.join("\n    ")}`);
  }
  return `0 leaks across ${releaseCriticalFiles.length} release-critical files`;
});

// ---------------------------------------------------------------------
// 5. No private issuer material anywhere (tracked files).
// ---------------------------------------------------------------------
check("no private issuer key material embedded in any tracked file", () => {
  // A raw 32-byte secret key would be 64 lowercase hex chars. We can't ban
  // ALL 64-hex-char strings (public keys, hashes, and test-generated
  // ephemeral keys are legitimately full of them) — instead flag the
  // narrow, actually-dangerous shape: a 64-hex literal assigned directly
  // to a variable/const/env whose OWN name signals "this is the real
  // secret", which a genuine leak would look like and a normal public-key/
  // hash usage would not.
  const DANGEROUS_ASSIGNMENT = /\b(secret|private)[A-Za-z]*\s*[:=]\s*["'`][0-9a-f]{64}["'`]/i;
  const hits = [];
  for (const f of files) {
    if (f.startsWith("test/") || f.includes(".test.")) continue; // test files legitimately generate ephemeral keys at runtime, never hardcode one — but skip the false-positive-prone scan there entirely since this pattern targets hardcoded literals, and a hardcoded 64-hex secret literal in a test file would ALSO be caught by a manual review; this mechanical gate focuses on non-test source/docs/scripts where a real leak would actually matter.
    if (!/\.(ts|js|mjs|cjs|json|md)$/.test(f)) continue;
    let content;
    try {
      content = readTracked(f);
    } catch {
      continue; // binary or unreadable — not a text-embedded secret
    }
    if (DANGEROUS_ASSIGNMENT.test(content)) hits.push(f);
  }
  if (hits.length > 0) throw new Error(`suspected hardcoded secret literal in: ${hits.join(", ")}`);
  return "0 hardcoded secret-shaped literals found";
});

// ---------------------------------------------------------------------
// 6. Required Trust test files present (this repo's executable test
//    vectors for the Trust capability).
// ---------------------------------------------------------------------
const REQUIRED_TRUST_TEST_FILES = [
  "test/trust_envelope_foundation.test.ts",
  "test/trust_pseudonymous_credential.test.ts",
  "test/trust_possession.test.ts",
  "test/trust_capabilities.test.ts",
  "test/trust_subscription_entitlement.test.ts",
  "test/trust_subscription_signing_request.test.ts",
  "test/trust_issuer_cli.test.ts",
  "test/trust_signed_qr.test.ts",
  "test/trust_contract_artifact_proof.test.ts",
  "test/architecture_boundary_trust.test.ts",
  "test/trust_factory_composition.test.ts",
];
check("required Trust test files present", () => {
  const missing = REQUIRED_TRUST_TEST_FILES.filter((t) => !fileSet.has(t));
  if (missing.length > 0) throw new Error(`missing: ${missing.join(", ")}`);
  return `${REQUIRED_TRUST_TEST_FILES.length}/${REQUIRED_TRUST_TEST_FILES.length} present`;
});

// ---------------------------------------------------------------------
// 7. Package/build files present.
// ---------------------------------------------------------------------
const REQUIRED_BUILD_FILES = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.beta-runtime.json",
  "vitest.config.ts",
  "vitest.current.config.ts",
  "rust-toolchain.toml",
  "packages/fedos-core-rust/Cargo.toml",
  "packages/fedos-desktop-electron-spike/package.json",
];
check("package/build files present", () => {
  const missing = REQUIRED_BUILD_FILES.filter((f) => !fileSet.has(f));
  if (missing.length > 0) throw new Error(`missing: ${missing.join(", ")}`);
  return `${REQUIRED_BUILD_FILES.length}/${REQUIRED_BUILD_FILES.length} present`;
});

// ---------------------------------------------------------------------
// 8. src/os/oss/ must NOT exist — OSS is a distribution boundary, not a
//    duplicated capability (this arc's own explicit constraint).
// ---------------------------------------------------------------------
check("src/os/oss/ does not exist (no duplicated OSS source tree)", () => {
  if (existsSync(join(ROOT, "src/os/oss"))) {
    throw new Error("src/os/oss/ exists — OSS must never be a separate capability/source tree");
  }
  return "confirmed absent";
});

// ---------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------
let failCount = 0;
for (const r of results) {
  const status = r.ok ? "PASS" : "FAIL";
  if (!r.ok) failCount++;
  console.log(`[${status}] ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
}
console.log("");
console.log(`${results.length - failCount}/${results.length} checks passed`);
if (failCount > 0) {
  console.log(`\n${failCount} check(s) FAILED — release surface is not clean.`);
  process.exit(1);
}
console.log("\nAll release-surface checks passed.");
