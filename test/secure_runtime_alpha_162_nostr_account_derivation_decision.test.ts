import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_162_nostr_account_derivation_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 162 -- "Nostr Account Derivation Decision": Stage 2
 * of the Deterministic Nostr Secret Key Derivation Arc. A DESIGN/DECISION
 * ONLY Stage -- zero code change. Compares Options A-E and adopts Option B
 * (HKDF(account index)).
 */
describe("Secure Runtime Alpha 162 -- Nostr Account Derivation Decision", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself DESIGN/DECISION ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is DESIGN \/ DECISION ONLY/);
    expect(designDocSource).toMatch(
      /It makes NO code\s*\nchange of any kind — no `src\/` file, no `packages\/` file, is modified\./,
    );
  });

  it("3. the design doc compares all five named options A-E", () => {
    const section = (designDocSource.match(/## 2\. Options compared([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    for (const label of ["Root-as-key", "HKDF(account index)", "Account Root", "BIP32-style HD wallet", "Random + store"]) {
      expect(section).toContain(label);
    }
  });

  it("4. the design doc adopts Option B explicitly", () => {
    expect(designDocSource).toMatch(
      /\*\*Option B — `Nostr Root → HKDF\(account index\) → 32-byte candidate →\s*\nk256::SecretKey` — is adopted\.\*\*/,
    );
  });

  it("5. the design doc fixes Account Index encoding as fixed-width big-endian, forbidding free strings", () => {
    const section = (designDocSource.match(/## 5\. Account Index encoding — per Alpha 143, unchanged([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Fixed-width big-endian binary, `u32` \(4 bytes\), NEVER an ASCII\s*\ndecimal string, NEVER variable-length\*\*/);
    expect(section).toMatch(/account_index\.to_be_bytes\(\)/);
  });

  it("6. the design doc decides invalid-scalar handling without a counter-based retry or modular reduction", () => {
    const section = (designDocSource.match(/## 6\. Invalid-scalar handling — decided here, detailed in Alpha 164([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    expect(section).toMatch(/no counter-based re-derivation loop/);
    expect(section).toMatch(/no\s*\nhand-rolled modular reduction/);
  });

  it("7. the design doc cross-references Alpha 161, 142, 143, and 144", () => {
    for (const ref of [
      "secure_runtime_alpha_161_existing_nostr_key_inventory",
      "secure_runtime_alpha_142_root_hierarchy_decision",
      "secure_runtime_alpha_143_domain_separation_decision",
      "secure_runtime_alpha_144_recovery_threat_model_decision",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("8. Regression: lib.rs carries no reference to this Stage's own doc -- confirming zero Rust change from this Stage", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_162/);
  });

  it("9. Regression: no FedosNostrAccountRootHandle-shaped type exists -- Option C was rejected, not silently implemented", () => {
    expect(libRsSource).not.toMatch(/struct\s+FedosNostrAccountRootHandle/);
    expect(libRsSource).not.toMatch(/struct\s+FedosAccountRootHandle/);
  });

  it("10. Regression: desktop_application.ts and worker.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_162/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_162/);
  });

  it("11. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_162/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_162/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
