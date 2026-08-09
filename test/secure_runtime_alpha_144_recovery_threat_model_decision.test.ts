import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_144_recovery_threat_model_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 144 -- "Recovery & Threat Model Decision":
 * Stage 4 of the Deterministic Identity Root Derivation Design Arc. A
 * DESIGN / DECISION ONLY Stage -- zero code change. Classifies
 * recoverable vs. non-recoverable, and reviews the Threat Model,
 * stating Master Seed leak impact plainly.
 */
describe("Secure Runtime Alpha 144 -- Recovery & Threat Model Decision", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(5000);
  });

  it("2. the design doc declares itself DESIGN / DECISION ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is DESIGN \/ DECISION ONLY/);
    expect(designDocSource).toMatch(
      /It makes NO code\s*\nchange of any kind — no `src\/` file, no `packages\/` file, is modified\./,
    );
  });

  it("3. the design doc's own recoverable list covers every item named in the Objective", () => {
    const section = (designDocSource.match(/## 2\. Recoverable — deterministically reconstructible from Master Seed \+ parameters([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    for (const item of [
      "Protocol Root",
      "Nostr Secret/Public Key pair",
      "Session identity key",
      "ATProto identity key",
      "Storage wrapping root",
      "Account-index-separated Identity",
      "Device-index-separated Identity",
    ]) {
      expect(section).toContain(item);
    }
  });

  it("4. the design doc's own non-recoverable list covers every item named in the Objective", () => {
    const section = (designDocSource.match(/## 3\. NOT recoverable — outside this contract's own scope, by design([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const item of [
      "Events lost from a Relay",
      "Data deleted server-side",
      "Desktop local UI state",
      "Cache contents",
      "Observation Events",
      "Lost external profile data",
      "Encrypted data bodies (ciphertext)",
    ]) {
      expect(section).toContain(item);
    }
  });

  it("5. the design doc's own non-recoverable section confirms ciphertext recovery needs BOTH the key and the ciphertext", () => {
    const section = (designDocSource.match(/## 3\. NOT recoverable — outside this contract's own scope, by design([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /BOTH the key and the ciphertext are required together;\s*\n\s*Master Seed recovery alone is insufficient/,
    );
  });

  it("6. the design doc's own Threat Model table covers all eleven threats named in the Objective", () => {
    const section = (designDocSource.match(/## 4\. Threat Model([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    for (const threat of [
      "Master Seed loss",
      "Master Seed leak",
      "One Protocol Root leak",
      "One Account Key leak",
      "Desktop compromise",
      "Memory dump",
      "Backup theft",
      "Rollback",
      "Derivation Version change",
      "Account Index collision",
      "Device Index collision",
    ]) {
      expect(section).toContain(threat);
    }
  });

  it("7. the design doc's Threat Model confirms Protocol Root leak is CONTAINED against Master Seed and sibling roots", () => {
    const section = (designDocSource.match(/## 4\. Threat Model([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Contained\*\* — HKDF domain separation \(Alpha 143 §3\/§4\) prevents deriving the Master Seed OR any sibling Protocol Root/,
    );
  });

  it("8. the design doc's Threat Model confirms Account Key leak is CONTAINED against Protocol Root and sibling Account Keys", () => {
    const section = (designDocSource.match(/## 4\. Threat Model([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Contained\*\* — HKDF's own one-way property prevents deriving the Protocol Root OR any sibling Account\/Device Key/,
    );
  });

  it("9. the design doc explicitly and plainly states Master Seed leak affects ALL derived Identities, with no containment", () => {
    const section = (designDocSource.match(/## 5\. Master Seed leak — impact stated plainly, not hidden([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*If the Master Seed leaks, EVERY derived Identity is affected — every\s*\nProtocol Root, every Account, every Device, across Nostr, Session,\s*\nATProto, Storage, Wallet, and any future protocol, ALL AT ONCE, with NO\s*\ncontainment possible at any level below the Master Seed itself\.\*\*/,
    );
  });

  it("10. the design doc explicitly confirms Protocol Root leak containment as a structural HKDF consequence, not a new invented property", () => {
    const section = (designDocSource.match(/## 6\. Protocol Root leak — impact stated plainly, confirmed contained([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*If a single Protocol Root leaks, it cannot be used to derive the\s*\nMaster Seed or any sibling Protocol Root/,
    );
    expect(section).toMatch(/not a new property\s*\nthis Arc invents/);
  });

  it("11. the design doc defers Master Seed backup storage method to a future Storage Review", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* decide HOW a Master Seed backup is stored — that is\s*\n\s*explicitly deferred to a future Storage Review/,
    );
  });

  it("12. the design doc cross-references Alpha 141, Alpha 142, Alpha 143, and vault_crypto_identity.md", () => {
    for (const ref of [
      "secure_runtime_alpha_141_existing_secret_kdf_inventory",
      "secure_runtime_alpha_142_root_hierarchy_decision",
      "secure_runtime_alpha_143_domain_separation_decision",
      "vault_crypto_identity.md",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression: zero code change anywhere
  // ---------------------------------------------------------------------

  it("13. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_144/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_144/);
  });

  it("14. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_144/);
  });

  it("15. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_144/);
    }
  });

  it("16. Regression: Rust/Cargo/package sources carry no reference to this Stage's own doc", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_144/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_144/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_144/);
  });
});
