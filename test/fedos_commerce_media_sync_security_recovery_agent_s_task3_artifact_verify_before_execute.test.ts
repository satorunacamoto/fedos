/**
 * FedOS Commerce Product-Media Sync + Truthful Completion mega-arc, Wave A
 * (Agent S) — Task 3: crypto-artifact verify-before-execute.
 *
 * Two layers:
 *   1. Pure unit tests of `fedosResolveProductionArtifactDir()` — no I/O,
 *      no WASM artifact, no Electron. This is the actual new gate.
 *   2. An end-to-end composition test proving this gate, combined with
 *      the EXISTING, unmodified hash/capability/export verification
 *      pipeline (`authorizeAndActivateFedosProductionDesktopMasterSeed()`),
 *      really does: pass a valid artifact, reject a tampered one, reject
 *      an override outside a test-gated context (no silent bypass), and
 *      allow an override inside an explicitly test-gated context.
 *      Deliberately built from FULLY SYNTHETIC bytes/manifest via this
 *      pipeline's own already-established `readBytes`/`readText`/
 *      `fileExists`/`importGlue` test seams — this suite never needs the
 *      real, gitignored `packages/fedos-core-rust/pkg/` artifact to be
 *      built, unlike `secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`.
 */
import { describe, it, expect } from "vitest";
import {
  fedosResolveProductionArtifactDir,
  fedosExpectedProductionWasmCrate,
  FEDOS_PRODUCTION_EXPECTED_WASM_CRATE,
  type FedosProductionArtifactDirRequest,
} from "../src/os/messenger/desktop/production_activation/fedos_production_wasm_artifact_verify_before_execute.js";
import {
  authorizeAndActivateFedosProductionDesktopMasterSeed,
} from "../src/os/messenger/desktop/production_activation/fedos_production_desktop_crypto_activation_authority.js";
import {
  fedosWasmArtifactSha256Hex,
  FEDOS_PRODUCTION_MASTER_SEED_CAPABILITY_PROFILE,
  FEDOS_PRODUCTION_MASTER_SEED_ALLOWED_EXPORTS,
  FEDOS_PRODUCTION_WASM_COMPATIBILITY_VERSION,
} from "../src/os/messenger/desktop/production_activation/fedos_production_wasm_artifact_manifest.js";
import { createElectronMainHostAttestation } from "../src/os/messenger/desktop/production_activation/fedos_production_desktop_host_attestation.js";

// ---------------------------------------------------------------------
// Layer 1 — the pure gate.
// ---------------------------------------------------------------------

function req(over: Partial<FedosProductionArtifactDirRequest> = {}): FedosProductionArtifactDirRequest {
  return {
    overrideArtifactDirEnvValue: undefined,
    testGateActive: false,
    defaultArtifactDir: "/safe/default/pkg",
    ...over,
  };
}

describe("fedosResolveProductionArtifactDir -- the gate", () => {
  it("no override requested -- always the default, regardless of test-gate state", () => {
    for (const testGateActive of [false, true]) {
      const d = fedosResolveProductionArtifactDir(req({ overrideArtifactDirEnvValue: undefined, testGateActive }));
      expect(d.outcome).toBe("default");
      expect(d.artifactDir).toBe("/safe/default/pkg");
    }
    const empty = fedosResolveProductionArtifactDir(req({ overrideArtifactDirEnvValue: "" }));
    expect(empty.outcome).toBe("default");
    const whitespaceOnly = fedosResolveProductionArtifactDir(req({ overrideArtifactDirEnvValue: "   " }));
    expect(whitespaceOnly.outcome).toBe("default");
  });

  it("REQUIRED: an override in a simulated PRODUCTION context (test gate NOT active) is rejected -- no silent bypass", () => {
    const decision = fedosResolveProductionArtifactDir(
      req({ overrideArtifactDirEnvValue: "C:\\Users\\attacker\\malicious-pkg", testGateActive: false }),
    );
    expect(decision.outcome).toBe("override-rejected-not-test-gated");
    // The untrusted path is NEVER returned as the directory to load from.
    expect(decision.artifactDir).toBe("/safe/default/pkg");
    expect(decision.artifactDir).not.toBe("C:\\Users\\attacker\\malicious-pkg");
    expect(decision.reason.toLowerCase()).toContain("ignored");
  });

  it("REQUIRED: an override WITH the explicit test-gate flag is allowed", () => {
    const decision = fedosResolveProductionArtifactDir(
      req({ overrideArtifactDirEnvValue: "/tmp/test-fixture-pkg", testGateActive: true }),
    );
    expect(decision.outcome).toBe("override-honored");
    expect(decision.artifactDir).toBe("/tmp/test-fixture-pkg");
  });

  it("trims surrounding whitespace on an honored override", () => {
    const decision = fedosResolveProductionArtifactDir(
      req({ overrideArtifactDirEnvValue: "  /tmp/test-fixture-pkg  ", testGateActive: true }),
    );
    expect(decision.artifactDir).toBe("/tmp/test-fixture-pkg");
  });

  it("never throws on any input shape", () => {
    expect(() => fedosResolveProductionArtifactDir(req({ overrideArtifactDirEnvValue: undefined }))).not.toThrow();
    expect(() => fedosResolveProductionArtifactDir(req({ overrideArtifactDirEnvValue: "" }))).not.toThrow();
  });
});

describe("fedosExpectedProductionWasmCrate -- pinned identity", () => {
  it("is a fixed, non-empty, in-source crate name", () => {
    expect(fedosExpectedProductionWasmCrate()).toEqual(FEDOS_PRODUCTION_EXPECTED_WASM_CRATE);
    expect(FEDOS_PRODUCTION_EXPECTED_WASM_CRATE.name).toBe("fedos-core-rust");
  });
});

// ---------------------------------------------------------------------
// Layer 2 — end-to-end composition with the EXISTING, UNMODIFIED
// verification pipeline, using fully synthetic bytes/manifest (no real
// WASM artifact required).
// ---------------------------------------------------------------------

function attestation() {
  return createElectronMainHostAttestation({ appId: "com.fedos.desktop.task3.test", appVersion: "0.0.1" })!;
}

function syntheticGlue(): object {
  return {
    FedosMasterSeedAuthority: function FedosMasterSeedAuthority() {},
    initSync: () => undefined,
  };
}

function syntheticManifestJson(wasmBytes: Uint8Array, over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    crateName: FEDOS_PRODUCTION_EXPECTED_WASM_CRATE.name,
    crateVersion: "0.0.0-test",
    wasmFilename: "fedos_core_rust_bg.wasm",
    jsGlueFilename: "fedos_core_rust.js",
    wasmSha256Hex: fedosWasmArtifactSha256Hex(wasmBytes),
    capabilityProfile: FEDOS_PRODUCTION_MASTER_SEED_CAPABILITY_PROFILE,
    allowedExports: [...FEDOS_PRODUCTION_MASTER_SEED_ALLOWED_EXPORTS],
    compatibilityVersion: FEDOS_PRODUCTION_WASM_COMPATIBILITY_VERSION,
    ...over,
  });
}

describe("Task 3 -- end-to-end: the gate composed with the existing verification pipeline", () => {
  it("REQUIRED: a valid (self-consistent, correctly-hashed) synthetic artifact passes", async () => {
    const wasmBytes = new TextEncoder().encode("synthetic-but-internally-consistent-wasm-bytes-for-task-3");
    const manifestText = syntheticManifestJson(wasmBytes);

    const result = await authorizeAndActivateFedosProductionDesktopMasterSeed({
      attestation: attestation(),
      expectedCrate: fedosExpectedProductionWasmCrate(),
      fileExists: () => true,
      readBytes: () => wasmBytes,
      readText: () => manifestText,
      importGlue: async () => syntheticGlue(),
    });
    expect(result.decision).toBe("permitted");
  });

  it("REQUIRED: a tampered artifact (bytes changed after the manifest's own hash was computed) is rejected", async () => {
    const originalBytes = new TextEncoder().encode("synthetic-but-internally-consistent-wasm-bytes-for-task-3");
    const manifestText = syntheticManifestJson(originalBytes); // hash pinned to the ORIGINAL bytes
    const tamperedBytes = new TextEncoder().encode("SYNTHETIC-BUT-TAMPERED-wasm-bytes-for-task-3!!!!!!!!!!!!!!");

    const result = await authorizeAndActivateFedosProductionDesktopMasterSeed({
      attestation: attestation(),
      expectedCrate: fedosExpectedProductionWasmCrate(),
      fileExists: () => true,
      readBytes: () => tamperedBytes, // the artifact on disk no longer matches the manifest's own hash
      readText: () => manifestText,
      importGlue: async () => syntheticGlue(),
    });
    expect(result.decision).toBe("artifact-invalid");
    if (result.decision !== "permitted") expect(result.reason).toContain("hash-mismatch");
  });

  it("REQUIRED: an override present in a simulated PRODUCTION context never reaches the verification pipeline at all -- no silent bypass", async () => {
    // The attacker's directory would ACTUALLY verify successfully on its
    // own terms (self-consistent malicious manifest+bytes) -- proving the
    // real defense is upstream: the gate must never hand this directory
    // to the pipeline in a non-test-gated context in the first place.
    const maliciousBytes = new TextEncoder().encode("attacker-supplied-self-consistent-malicious-wasm-bytes");
    const maliciousManifestText = syntheticManifestJson(maliciousBytes);

    const gateDecision = fedosResolveProductionArtifactDir({
      overrideArtifactDirEnvValue: "/attacker/controlled/pkg",
      testGateActive: false, // simulated production: no explicit test mode
      defaultArtifactDir: "/safe/pinned/pkg",
    });
    expect(gateDecision.outcome).toBe("override-rejected-not-test-gated");
    expect(gateDecision.artifactDir).toBe("/safe/pinned/pkg");
    expect(gateDecision.artifactDir).not.toBe("/attacker/controlled/pkg");

    // Even proving the malicious content WOULD have passed verification on
    // its own (self-consistent) terms -- demonstrating that hash/manifest
    // verification ALONE is not the defense here; the gate is.
    const wouldHavePermitted = await authorizeAndActivateFedosProductionDesktopMasterSeed({
      attestation: attestation(),
      fileExists: () => true,
      readBytes: () => maliciousBytes,
      readText: () => maliciousManifestText,
      importGlue: async () => syntheticGlue(),
    });
    expect(wouldHavePermitted.decision).toBe("permitted");
    // ...which is exactly why the Coordinator's own call site must use
    // `gateDecision.artifactDir` (the safe default), never the raw env
    // value, when constructing the real `artifactDir`/`fileExists`/
    // `readBytes`/`readText` the production pipeline actually reads from.
  });

  it("REQUIRED: an override present WITH the explicit test-gate flag is honored end-to-end", async () => {
    const testFixtureBytes = new TextEncoder().encode("legitimate-test-fixture-wasm-bytes-for-task-3");
    const testFixtureManifestText = syntheticManifestJson(testFixtureBytes);

    const gateDecision = fedosResolveProductionArtifactDir({
      overrideArtifactDirEnvValue: "/tmp/legit-test-fixture-pkg",
      testGateActive: true, // explicit test mode
      defaultArtifactDir: "/safe/pinned/pkg",
    });
    expect(gateDecision.outcome).toBe("override-honored");
    expect(gateDecision.artifactDir).toBe("/tmp/legit-test-fixture-pkg");

    const result = await authorizeAndActivateFedosProductionDesktopMasterSeed({
      attestation: attestation(),
      artifactDir: gateDecision.artifactDir,
      expectedCrate: fedosExpectedProductionWasmCrate(),
      fileExists: () => true,
      readBytes: () => testFixtureBytes,
      readText: () => testFixtureManifestText,
      importGlue: async () => syntheticGlue(),
    });
    expect(result.decision).toBe("permitted");
  });

  it("expectedCrate mismatch is rejected even for an otherwise-valid artifact (the previously-dead unapproved-build path, now reachable)", async () => {
    const wasmBytes = new TextEncoder().encode("otherwise-valid-synthetic-wasm-bytes");
    const manifestText = syntheticManifestJson(wasmBytes, { crateName: "some-other-crate" });

    const result = await authorizeAndActivateFedosProductionDesktopMasterSeed({
      attestation: attestation(),
      expectedCrate: fedosExpectedProductionWasmCrate(),
      fileExists: () => true,
      readBytes: () => wasmBytes,
      readText: () => manifestText,
      importGlue: async () => syntheticGlue(),
    });
    expect(result.decision).toBe("unapproved-build");
  });
});
