import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_166_existing_nostr_public_key_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationKeySource from "../packages/fedos-core-rust/src/crypto/conversation_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrTypesSource from "../src/os/messenger/adapters/nostr/protocol/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrCryptoSource from "../src/os/messenger/adapters/nostr/protocol/crypto.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nobleSignatureSource from "../src/os/messenger/adapters/nostr/protocol/noble_signature.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 166 -- "Existing Nostr Public Key Inventory": Stage 1
 * of the Deterministic Nostr Public Key Derivation Arc. A DESIGN/DECISION
 * ONLY Stage -- zero code change. Inventories the existing k256/Nostr
 * public-key surface this Arc will build on.
 */
describe("Secure Runtime Alpha 166 -- Existing Nostr Public Key Inventory", () => {
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

  it("3. the design doc's own seven required questions are all answered, and confirms no new dependency is needed", () => {
    const section = (designDocSource.match(/## 3\. Answers to the seven required questions([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section.length).toBeGreaterThan(0);
    for (let i = 1; i <= 7; i++) {
      expect(section).toMatch(new RegExp(`${i}\\. \\*\\*`));
    }
    expect(section).toMatch(/No new dependency is needed/);
  });

  it("4. the design doc confirms Nostr requires a 32-byte x-only public key, not SEC1 compressed", () => {
    expect(designDocSource).toMatch(/CONFIRMED x-only/);
    expect(designDocSource).toMatch(/32-byte lowercase hex secp256k1 \*\*x-only\*\* public key/);
  });

  it("5. the design doc cross-references Alpha 161 and Alpha 165", () => {
    for (const ref of [
      "secure_runtime_alpha_161_existing_nostr_key_inventory",
      "secure_runtime_alpha_165_nostr_secret_key_derivation_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the inventory's own claims directly against source
  // ---------------------------------------------------------------------

  it("6. structural: NostrEvent.pubkey is documented as a 32-byte x-only public key", () => {
    expect(nostrTypesSource).toMatch(
      /32-byte lowercase hex secp256k1 x-only public key of the author\./,
    );
  });

  it("7. RIPPLE (Secure Runtime Alpha 181): k256 was arithmetic-only -- no schnorr/ecdsa feature enabled -- AS OF this Stage's own closing state, matching the inventory's own finding at that time; Stage 1029 (Secure Runtime Alpha 181) legitimately added the schnorr feature in a LATER Arc for real Schnorr signing -- ecdsa remains excluded, reconfirmed here as the CURRENT state", () => {
    expect(cargoTomlSource).toMatch(
      /k256 = \{ version = "0\.13", default-features = false, features = \["arithmetic", "schnorr"\] \}/,
    );
    expect(cargoTomlSource).not.toMatch(/features = \["arithmetic", "schnorr", "ecdsa"/);
  });

  it("8. structural: k256::PublicKey was not imported by conversation_key.rs -- the ONLY pre-existing k256-consuming file this inventory examined, confirming it is a genuinely NEW use introduced by a LATER Stage in this Arc, not something already present", () => {
    expect(conversationKeySource).not.toMatch(/k256::PublicKey|\bPublicKey\b/);
  });

  it("9. structural: conversation_key.rs already lifts an x-only pub2 with a 0x02 SEC1 tag -- the existing even-Y precedent this Arc's own derivation must match", () => {
    expect(conversationKeySource).toMatch(/compressed_pub2\[0\] = 0x02;/);
  });

  it("10. structural: src/nostr/crypto.ts and noble_signature.ts remain hashing/verification-only -- no keygen", () => {
    expect(nostrCryptoSource).not.toMatch(/generateSecretKey|randomPrivateKey|getPublicKey/);
    expect(nobleSignatureSource).toMatch(
      /This module verifies only; it never signs\. No private keys are involved\./,
    );
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("11. Regression: lib.rs carries no reference to this Stage's own doc -- confirming zero Rust change from this Stage", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_166/);
  });

  it("12. Regression: src/nostr/* carries no reference to this Stage's own doc", () => {
    expect(nostrTypesSource).not.toMatch(/secure_runtime_alpha_166/);
    expect(nostrCryptoSource).not.toMatch(/secure_runtime_alpha_166/);
    expect(nobleSignatureSource).not.toMatch(/secure_runtime_alpha_166/);
  });

  it("13. Regression: desktop_application.ts and worker.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_166/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_166/);
  });

  it("14. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_166/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_166/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
