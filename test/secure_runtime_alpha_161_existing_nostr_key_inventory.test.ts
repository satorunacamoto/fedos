import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_161_existing_nostr_key_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationKeySource from "../packages/fedos-core-rust/src/crypto/conversation_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrCryptoSource from "../src/os/messenger/adapters/nostr/protocol/crypto.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nobleSignatureSource from "../src/os/messenger/adapters/nostr/protocol/noble_signature.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 161 -- "Existing secp256k1 / Nostr Key Inventory":
 * Stage 1 of the Deterministic Nostr Secret Key Derivation Arc. A
 * DESIGN/DECISION ONLY Stage -- zero code change. Inventories the
 * existing k256/Nostr/SecretHandle surface this Arc will build on.
 */
describe("Secure Runtime Alpha 161 -- Existing secp256k1 / Nostr Key Inventory", () => {
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

  it("3. the design doc's own five required questions are all answered", () => {
    const section = (designDocSource.match(/## 3\. Answers to the five required questions([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section.length).toBeGreaterThan(0);
    for (let i = 1; i <= 5; i++) {
      expect(section).toMatch(new RegExp(`${i}\\. \\*\\*`));
    }
    expect(section).toMatch(/`k256::SecretKey`/);
    expect(section).toMatch(/\*\*Is a new dependency needed\?\*\* No\./);
  });

  it("4. the design doc cross-references Alpha 141, 143, 144, and 160", () => {
    for (const ref of [
      "secure_runtime_alpha_141_existing_secret_kdf_inventory",
      "secure_runtime_alpha_143_domain_separation_decision",
      "secure_runtime_alpha_144_recovery_threat_model_decision",
      "secure_runtime_alpha_160_integration_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the inventory's own claims directly against source
  // ---------------------------------------------------------------------

  it("5. structural: k256::SecretKey::from_slice is the crate's existing reusable scalar-validation entry point", () => {
    expect(conversationKeySource).toMatch(/use k256::\{AffinePoint, EncodedPoint, ProjectivePoint, SecretKey\};/);
    expect(conversationKeySource).toMatch(/SecretKey::from_slice\(&sec1_bytes\)/);
  });

  it("6. RIPPLE (Secure Runtime Alpha 181): k256 was arithmetic-only, no ecdsa/schnorr feature enabled, AS OF this Stage's own closing state; Stage 1029 (Secure Runtime Alpha 181) legitimately added the schnorr feature in a LATER Arc for real Schnorr signing -- ecdsa remains excluded, reconfirmed here as the CURRENT state", () => {
    expect(cargoTomlSource).toMatch(
      /k256 = \{ version = "0\.13", default-features = false, features = \["arithmetic", "schnorr"\] \}/,
    );
    expect(cargoTomlSource).not.toMatch(/features = \["arithmetic", "schnorr", "ecdsa"/);
  });

  it("7. structural: src/nostr/crypto.ts hashes and compares only -- no keygen, no signing", () => {
    expect(nostrCryptoSource).toMatch(/webCryptoSha256Hex/);
    expect(nostrCryptoSource).not.toMatch(/generateSecretKey|randomPrivateKey|schnorr\.sign|getPublicKey/);
  });

  it("8. structural: src/nostr/noble_signature.ts verifies only -- its own header says so", () => {
    expect(nobleSignatureSource).toMatch(
      /This module verifies only; it never signs\. No private keys are involved\./,
    );
    expect(nobleSignatureSource).not.toMatch(/schnorr\.sign|randomPrivateKey/);
  });

  it("9. structural: no AccountIndex type or to_be_bytes-encoded index exists yet in lib.rs", () => {
    expect(libRsSource).not.toMatch(/struct AccountIndex/);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("10. Regression: lib.rs carries no reference to this Stage's own doc -- confirming zero Rust change from this Stage", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_161/);
  });

  it("11. Regression: src/nostr/crypto.ts and noble_signature.ts carry no reference to this Stage's own doc", () => {
    expect(nostrCryptoSource).not.toMatch(/secure_runtime_alpha_161/);
    expect(nobleSignatureSource).not.toMatch(/secure_runtime_alpha_161/);
  });

  it("12. Regression: desktop_application.ts and worker.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_161/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_161/);
  });

  it("13. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_161/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_161/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
