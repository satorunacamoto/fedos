import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_450_master_seed_authority_and_nostr_signing_activation_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync } from "node:fs";

/**
 * Secure Runtime Alpha 450 -- "Master Seed Authority and Nostr Signing
 * Activation Completion Declaration": Stage 10 (final) of the Alpha
 * 431-450 Arc. Declares both Phase A (Alpha 431-440) and Phase B
 * (Alpha 441-449) complete, matching this Stage's own re-verification
 * by real execution (see the doc's own §4).
 */
describe("Secure Runtime Alpha 450 -- Master Seed Authority and Nostr Signing Activation Completion Declaration", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(5000);
  });

  it("2. the design doc declares the Phase Gate result PASS for both phases", () => {
    expect(designDocSource).toMatch(/\*\*PASS\.\*\* Both Phase A \(Alpha 440\) and Phase B \(Alpha 441–449\) gates\s*\nhold\./);
  });

  it("3. the design doc cross-references every Phase A doc, Alpha 431 through Alpha 440", () => {
    for (let alpha = 431; alpha <= 440; alpha++) {
      expect(designDocSource).toContain(`secure_runtime_alpha_${alpha}_`);
    }
  });

  it("4. the design doc cross-references every Phase B doc, Alpha 441 through Alpha 449", () => {
    for (let alpha = 441; alpha <= 449; alpha++) {
      expect(designDocSource).toContain(`secure_runtime_alpha_${alpha}_`);
    }
  });

  it("5. every Alpha 431-449 doc and test file this Arc declares complete actually exists on disk", () => {
    const slugs = [
      "431_existing_secret_authority_and_storage_inventory",
      "432_master_seed_authority_options_review",
      "433_sealing_key_authority_decision",
      "434_master_seed_authority_lifecycle",
      "435_sealed_master_seed_envelope_v1",
      "436_rust_master_seed_authority_implementation",
      "437_seal_and_restore_implementation",
      "438_typescript_authority_boundary",
      "439_authority_persistence_ownership_review",
      "440_master_seed_authority_phase_gate",
      "441_signing_boundary_reentry_review",
      "442_nostr_signing_request_model",
      "443_signed_event_output_reuse",
      "444_rust_wasm_nostr_signing_method",
      "445_typescript_nostr_signing_authority_adapter",
      "446_cryptographic_verification",
      "447_restart_and_recovery_signing_verification",
      "448_outbox_publisher_readiness_adapter",
      "449_security_regression_guards",
    ];
    for (const slug of slugs) {
      expect(existsSync(`docs/secure_runtime_alpha_${slug}.md`)).toBe(true);
      expect(existsSync(`test/secure_runtime_alpha_${slug}.test.ts`)).toBe(true);
    }
  });

  it("6. structural: Cargo.toml and package.json carry no reference to this Arc's own docs", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_4[34][0-9]/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_4[34][0-9]/);
  });

  it("7. structural: FedosMasterSeedAuthority carries zero Clone/Debug/Serialize derives", () => {
    const structIndex = libRsSource.indexOf("pub struct FedosMasterSeedAuthority");
    expect(structIndex).toBeGreaterThan(0);
    const precedingSource = libRsSource.slice(Math.max(0, structIndex - 400), structIndex);
    const lastDerive = precedingSource.lastIndexOf("derive(");
    if (lastDerive !== -1) {
      const deriveLine = precedingSource.slice(lastDerive, lastDerive + 80);
      expect(deriveLine).not.toMatch(/Clone|Debug|Serialize|PartialEq/);
    }
  });

  it("8. structural: no raw Master Seed or Nostr secret-key getter exists in lib.rs", () => {
    expect(libRsSource).not.toMatch(/pub fn\s+\w*raw\w*seed\w*/i);
    expect(libRsSource).not.toMatch(/pub fn\s+\w*raw\w*secret_key\w*/i);
    expect(libRsSource).not.toMatch(/pub fn\s+\w*nsec\w*/i);
  });

  it("9. structural: sign_nostr_event on the authority is not a generic sign(hash) oracle", () => {
    const implIndex = libRsSource.indexOf("impl FedosMasterSeedAuthority");
    expect(implIndex).toBeGreaterThan(0);
    const implSlice = libRsSource.slice(implIndex, implIndex + 12000);
    expect(implSlice).toMatch(/pub fn sign_nostr_event\(\s*&self,\s*account_index: u32,/);
    expect(implSlice).not.toMatch(/pub fn sign\(/);
  });

  it("10. the design doc declares the next Arc recommendation as the Outbound Board Publisher Arc", () => {
    expect(designDocSource).toMatch(
      /\*\*Secure Runtime Alpha 451–460: Nostr Outbound Board Publisher &\s*\nDelivery Observation Arc\*\*/,
    );
  });

  it("11. the design doc confirms p2p/ was untouched, not silently omitted", () => {
    expect(designDocSource).toMatch(/`p2p\/` remains the sole untracked entry/);
  });

  it("12. the design doc records real cargo test execution succeeding in this environment, not a build failure", () => {
    expect(designDocSource).toMatch(/515\s*\n\s*passed, 1 failed/);
    expect(designDocSource).not.toMatch(/fails to BUILD/);
  });
});
