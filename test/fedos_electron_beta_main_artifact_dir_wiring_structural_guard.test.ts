/**
 * Real Digital Delivery Release Closure arc (Agent R) — Step 4 (artifact
 * verify-before-execute live check).
 *
 * REAL BUG FOUND AND FIXED by this arc: `fedos_production_wasm_artifact_verify_before_execute.ts`'s
 * own `fedosResolveProductionArtifactDir()` gate (Commerce Product-Media
 * Sync mega-arc, Agent S, Task 3) is correct in isolation — proven by
 * `test/fedos_commerce_media_sync_security_recovery_agent_s_task3_artifact_verify_before_execute.test.ts`,
 * which calls it with a HARDCODED, override-independent `defaultArtifactDir`
 * ("/safe/default/pkg"). But the ONE real call site
 * (`buildFreshCoordinator()` in `fedos_electron_beta_main.cts`) fed it
 * `defaultArtifactDir: artifactDir()` — and `artifactDir()` ITSELF used to
 * read `process.env.FEDOS_ELECTRON_BETA_ARTIFACT_DIR` and return the raw
 * override directly when set. So in a simulated production launch
 * (override set, `AUTOTEST_MODE` empty i.e. `testGateActive: false`):
 *
 *   1. `artifactDir()` already resolves to the ATTACKER'S directory
 *      (nothing gates it at that point).
 *   2. `fedosResolveProductionArtifactDir()` correctly computes
 *      `outcome: "override-rejected-not-test-gated"` ...
 *   3. ... but returns `artifactDir: request.defaultArtifactDir`, which
 *      step 1 had ALREADY set to the attacker's directory.
 *   4. `activateFedosProductionProfileMasterSeed({ artifactDir:
 *      artifactDirDecision.artifactDir, ... })` therefore still loads from
 *      the attacker's directory, despite the logged "rejected" outcome.
 *
 * The gate's own rejection was real and its own diagnostic log fired, but
 * the actual bytes loaded were never protected — a purely cosmetic
 * rejection. This is the exact class of "real backend, wiring never
 * connects it" gap this repository's own audit history repeatedly finds.
 *
 * FIX (this arc): `artifactDir()` no longer reads the environment
 * override at all — it is now the pinned, override-BLIND default the
 * verify-before-execute module's own call-site notes always specified.
 * The override is read and gated EXCLUSIVELY by
 * `fedosResolveProductionArtifactDir()` at the call site.
 *
 * This file cannot import `fedos_electron_beta_main.cts` directly (it is
 * Electron main-process code — imports the real `electron` module, which
 * does not resolve outside a real Electron process). Matches this
 * repository's own established convention for asserting Electron
 * main-process wiring by direct source inspection (see e.g.
 * `secure_runtime_alpha_7321_7400_structural_guards.test.ts`,
 * `commerce_coordinator_integration_structural_guards.test.ts`, and every
 * other `*_structural_guards.test.ts` file) — real regex assertions
 * against the real shipped source text, not a narrative claim.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const MAIN_PATH = join(
  REPO_ROOT,
  "packages",
  "fedos-desktop-electron-spike",
  "src",
  "fedos_electron_beta_main.cts",
);

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Extracts the body of `function artifactDir(): string { ... }` — the ONE function this regression is about. Fails loudly (never silently matches nothing) if the function is renamed/removed/restructured beyond what this guard expects. */
function extractArtifactDirFunctionBody(strippedSource: string): string {
  const m = /function\s+artifactDir\s*\(\s*\)\s*:\s*string\s*\{([\s\S]*?)\n\}/.exec(strippedSource);
  const body = m?.[1];
  if (body === undefined) {
    throw new Error(
      "artifactDir() function not found in fedos_electron_beta_main.cts in the expected shape -- " +
        "this guard needs updating alongside whatever restructuring moved/renamed it, not silently skipped.",
    );
  }
  return body;
}

describe("fedos_electron_beta_main.cts -- artifact-dir override gate wiring (Step 4 regression guard)", () => {
  const rawSource = read(MAIN_PATH);
  const source = stripComments(rawSource);

  it("REGRESSION: artifactDir() no longer reads FEDOS_ELECTRON_BETA_ARTIFACT_DIR itself -- it is the pinned, override-blind default", () => {
    const body = extractArtifactDirFunctionBody(source);
    expect(body).not.toMatch(/process\.env/);
    expect(body).not.toMatch(/FEDOS_ELECTRON_BETA_ARTIFACT_DIR/);
    // Still returns the same pinned path shape as before the fix (no
    // unrelated behavior change).
    expect(body).toMatch(/fedos-core-rust/);
    expect(body).toMatch(/pkg/);
  });

  it("the ONLY place FEDOS_ELECTRON_BETA_ARTIFACT_DIR is read is the overrideArtifactDirEnvValue field passed into the real gate", () => {
    const readSites = [...source.matchAll(/process\.env\.FEDOS_ELECTRON_BETA_ARTIFACT_DIR/g)];
    // Exactly one textual read site: overrideArtifactDirEnvValue's own
    // assignment. (Before the fix there were two: this one, and the one
    // inside the old vulnerable artifactDir() body.)
    expect(readSites.length).toBe(1);
    const idx = source.indexOf("process.env.FEDOS_ELECTRON_BETA_ARTIFACT_DIR");
    const surrounding = source.slice(Math.max(0, idx - 200), idx + 50);
    expect(surrounding).toMatch(/overrideArtifactDirEnvValue\s*:/);
  });

  it("buildFreshCoordinator() still wires defaultArtifactDir to the (now safe) artifactDir() pinned default", () => {
    const callSite = /const\s+artifactDirDecision\s*=\s*m\.fedosResolveProductionArtifactDir\(\s*\{([\s\S]*?)\}\s*\)\s*;/.exec(
      source,
    );
    expect(callSite, "fedosResolveProductionArtifactDir(...) call site not found").not.toBeNull();
    const args = callSite![1];
    expect(args).toMatch(/overrideArtifactDirEnvValue\s*:\s*process\.env\.FEDOS_ELECTRON_BETA_ARTIFACT_DIR/);
    expect(args).toMatch(/testGateActive\s*:\s*AUTOTEST_MODE\.length\s*>\s*0/);
    expect(args).toMatch(/defaultArtifactDir\s*:\s*artifactDir\(\)/);
  });

  it("activateFedosProductionProfileMasterSeed() receives the GATE'S decision, never the raw env value or a second independent artifactDir() call", () => {
    const activationCall = /const\s+activation\s*=\s*await\s+m\.activateFedosProductionProfileMasterSeed\(\s*\{([\s\S]*?)\}\s*\)\s*;/.exec(
      source,
    );
    expect(activationCall, "activateFedosProductionProfileMasterSeed(...) call site not found").not.toBeNull();
    const args = activationCall![1];
    expect(args).toMatch(/artifactDir\s*:\s*artifactDirDecision\.artifactDir/);
    expect(args).not.toMatch(/artifactDir\s*:\s*process\.env/);
    expect(args).toMatch(/expectedCrate\s*:\s*m\.fedosExpectedProductionWasmCrate\(\)/);
  });

  it("BEHAVIORAL: replaying the real (fixed) composition logic with the real gate function proves a non-test-gated override never reaches activation", async () => {
    // Uses the REAL, unmodified `fedosResolveProductionArtifactDir` (the
    // actual production gate, imported for real -- not reimplemented),
    // fed the SAME shape of inputs the real call site now produces after
    // the fix: an override-BLIND default (mirrors the fixed `artifactDir()`,
    // proven override-blind by the regression test above) and the real
    // gating fields.
    const { fedosResolveProductionArtifactDir } = await import(
      "../src/os/messenger/desktop/production_activation/fedos_production_wasm_artifact_verify_before_execute.js"
    );

    const PINNED_SAFE_DEFAULT = "/pinned/fedos-core-rust/pkg"; // stands in for the real path.join(__dirname, "..", "..", "fedos-core-rust", "pkg")
    const attackerOverride = "C:\\Users\\attacker\\malicious-pkg";

    // Simulated production launch: override present, AUTOTEST_MODE empty.
    const decision = fedosResolveProductionArtifactDir({
      overrideArtifactDirEnvValue: attackerOverride,
      testGateActive: false,
      defaultArtifactDir: PINNED_SAFE_DEFAULT, // override-blind, exactly as the fixed artifactDir() now behaves
    });

    expect(decision.outcome).toBe("override-rejected-not-test-gated");
    expect(decision.artifactDir).toBe(PINNED_SAFE_DEFAULT);
    expect(decision.artifactDir).not.toBe(attackerOverride);

    // Explicit test-gated launch: override honored, as designed.
    const testDecision = fedosResolveProductionArtifactDir({
      overrideArtifactDirEnvValue: "/tmp/legit-fixture-pkg",
      testGateActive: true,
      defaultArtifactDir: PINNED_SAFE_DEFAULT,
    });
    expect(testDecision.outcome).toBe("override-honored");
    expect(testDecision.artifactDir).toBe("/tmp/legit-fixture-pkg");
  });
});
