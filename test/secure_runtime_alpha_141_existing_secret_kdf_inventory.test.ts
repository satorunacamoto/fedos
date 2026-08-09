import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_141_existing_secret_kdf_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import vaultCryptoIdentitySource from "../docs/vault_crypto_identity.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoTestVectorsSource from "../docs/crypto_test_vectors.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrCryptoSource from "../src/nostr/crypto.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublishSource from "../src/nostr/publish.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrIdentityProviderSource from "../src/os/core/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recoveryPolicySource from "../src/os/core/identity/recovery_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 141 -- "Existing Secret / KDF Inventory": Stage
 * 1 of the Deterministic Identity Root Derivation Design Arc. A
 * DESIGN / DECISION ONLY Stage -- zero code change. Inventories what
 * secret-handling and KDF infrastructure already exists, grounded in
 * actual source.
 */
describe("Secure Runtime Alpha 141 -- Existing Secret / KDF Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(6000);
  });

  it("2. the design doc declares itself DESIGN / DECISION ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is DESIGN \/ DECISION ONLY/);
    expect(designDocSource).toMatch(
      /It makes NO code\s*\nchange of any kind — no `src\/` file, no `packages\/` file, is modified\./,
    );
  });

  it("3. structural: no Master Seed type exists in the actual Rust source -- confirmed directly, not just via the doc's own claim", () => {
    expect(libRsSource).not.toMatch(/struct\s+MasterSeed/);
    expect(libRsSource).not.toMatch(/enum\s+MasterSeed/);
  });

  it("4. structural: HkdfDomain is confirmed as a real, closed, five-variant enum with fixed compile-time salt/info -- grounding the doc's own composability claim", () => {
    expect(libRsSource).toMatch(/pub\(crate\) enum HkdfDomain \{/);
    expect(libRsSource).toMatch(/RootKey,/);
    expect(libRsSource).toMatch(/Identity,/);
    expect(libRsSource).toMatch(/Storage,/);
    expect(libRsSource).toMatch(/Conversation,/);
    expect(libRsSource).toMatch(/TestOnly,/);
    expect(libRsSource).toMatch(/b"fedos-hkdf-salt-root-key-v1"/);
    expect(libRsSource).toMatch(/b"fedos-hkdf-info-root-key-v1"/);
  });

  it("5. structural: derive_secret_handle_internal is confirmed to exist as the real HKDF entry point", () => {
    expect(libRsSource).toMatch(/fn derive_secret_handle_internal/);
  });

  it("6. structural: SecretHandle is confirmed pub(crate), never pub, never wasm_bindgen-annotated", () => {
    expect(libRsSource).toMatch(/pub\(crate\) struct SecretHandle/);
    expect(libRsSource).not.toMatch(/^pub struct SecretHandle/m);
  });

  it("7. structural: FedosAeadKeyHandle is confirmed to wrap SecretHandle opaquely with no public raw-byte getter", () => {
    expect(libRsSource).toMatch(/pub struct FedosAeadKeyHandle \{\s*\n\s*inner: secret_handle::SecretHandle,?\s*\n\s*\}/);
  });

  it("8. RIPPLE (Secure Runtime Alpha 146): exactly 13 #[wasm_bindgen] annotations existed AS OF this Stage's own scope, matching the doc's own count, and none was a key-derivation function; a LATER Arc (Alpha 146-150) legitimately added Rust doc comments that mention the literal string `#[wasm_bindgen]` in prose (never as a real annotation), so this count is now measured with a line-anchored regex -- the real annotation count remains 13, and still no key-derivation function is wasm_bindgen-exported, reconfirmed here as the CURRENT state", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    expect(libRsSource).not.toMatch(/^#\[wasm_bindgen\]\s*\n\s*(?:pub\s+)?fn derive/m);
  });

  it("9. structural: vault_crypto_identity.md's own 'no key custody' guiding principle and 'no derivation is performed' closing statement are confirmed verbatim", () => {
    expect(vaultCryptoIdentitySource).toMatch(
      /\*\*No key custody in the app\.\*\* The app already holds\/generates\/stores no\s*\n\s*private key/,
    );
    expect(vaultCryptoIdentitySource).toMatch(/No derivation is performed\s*\n\s*anywhere in this repo\./);
  });

  it("10. structural: crypto_test_vectors.md's own domain-separation mandate is confirmed verbatim", () => {
    expect(cryptoTestVectorsSource).toMatch(/\*\*Domain separation is mandatory\.\*\*/);
  });

  it("11. structural: AppRuntime has no deriveKey field -- confirmed directly against the actual interface, not just the doc's own claim", () => {
    expect(runtimeTypesSource).not.toMatch(/readonly deriveKey:/);
    expect(runtimeTypesSource).toMatch(/deriveKey\(\)/);
  });

  it("12. structural: no Nostr secret-key generation exists -- confirmed against the actual nostr/crypto.ts, nostr/publish.ts, and identity provider sources", () => {
    expect(nostrCryptoSource).not.toMatch(/generateSecretKey|getPublicKey\(/);
    expect(nostrPublishSource).toMatch(/nothing here signs, generates, or stores a key/);
    expect(nostrIdentityProviderSource).toMatch(/secret key|nsec|seed|mnemonic/i);
  });

  it("13. structural: recovery_policy.ts's own hard guardrail against password/recovery phrase/mnemonic/seed is confirmed verbatim", () => {
    expect(recoveryPolicySource).toMatch(
      /NO password, recovery phrase, mnemonic, seed, backup, export,\s*\n\s*\*\s*import, sync, or authentication field of any kind/,
    );
  });

  it("14. the design doc answers all five confirmation questions", () => {
    const section = (designDocSource.match(/## 3\. Answers to the five confirmation questions([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Can the existing KDF be reused\?\*\* Yes\./);
    expect(section).toMatch(/\*\*Is new Rust implementation needed\?\*\* Yes, but narrowly:/);
    expect(section).toMatch(/\*\*Can this be implemented without ever exposing raw secret bytes to\s*\n\s*JS\?\*\* Yes/);
    expect(section).toMatch(/\*\*Does this contradict the existing Secret Handle policy\?\*\* No/);
    expect(section).toMatch(
      /\*\*Does the current Public Crypto API have derived-key functionality\s*\n\s*today\?\*\* No/,
    );
  });

  it("15. the design doc cross-references all five relevant existing docs", () => {
    for (const ref of [
      "vault_crypto_identity.md",
      "secret_handle_api_shape.md",
      "secret_lifecycle_implementation_plan.md",
      "secret_memory_test_strategy.md",
      "crypto_test_vectors.md",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression: zero src/ change anywhere, confirmed across every
  // previously-touched file in this whole Identity/Desktop lineage
  // ---------------------------------------------------------------------

  it("16. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc, confirming zero code change", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_141/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_141/);
  });

  it("17. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_141/);
  });

  it("18. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_141/);
    }
  });

  it("19. Regression: Rust/Cargo/package sources carry no reference to this Stage's own doc -- confirming zero Rust change", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_141/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_141/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_141/);
  });
});
