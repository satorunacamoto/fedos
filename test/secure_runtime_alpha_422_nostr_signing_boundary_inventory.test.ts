import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_422_nostr_signing_boundary_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import vaultTypesSource from "../src/os/core/vault/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeIdentitySource from "../src/os/core/identity/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";

/**
 * Secure Runtime Alpha 422 -- "Existing Rust / WASM Boundary
 * Inventory": Stage 1 of the Alpha 422-430 Nostr Outbound Signing
 * Boundary Decision & Foundation Arc (Phase A). Review only.
 */
describe("Secure Runtime Alpha 422 -- Existing Rust / WASM Boundary Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(5000);
  });

  it("2. structural: every Nostr signing Handle/derivation item is pub(crate), never pub", () => {
    for (const item of [
      "struct FedosNostrSecretKeyHandle",
      "fn derive_nostr_secret_key_internal",
      "struct FedosNostrPublicKeyHandle",
      "fn derive_nostr_public_key_internal",
      "struct FedosNostrSignatureHandle",
      "struct FedosNostrEventHandle",
      "fn derive_nostr_event_id_internal",
      "fn sign_nostr_event_internal",
    ]) {
      expect(libRsSource, item).toMatch(new RegExp(`pub\\(crate\\) ${item}`));
    }
  });

  it("3. structural: the AeadKeyHandle/AeadCiphertextHandle WASM precedent exists and neither derives Clone", () => {
    expect(libRsSource).toMatch(/pub struct AeadKeyHandle \{/);
    expect(libRsSource).toMatch(/pub struct AeadCiphertextHandle \{/);
    const keyHandleBlock = (libRsSource.match(/pub struct AeadKeyHandle \{[\s\S]{0,80}/) ?? [""])[0];
    const ciphertextHandleBlock = (libRsSource.match(/pub struct AeadCiphertextHandle \{[\s\S]{0,80}/) ?? [""])[0];
    expect(keyHandleBlock).not.toMatch(/derive\(.*Clone/);
    expect(ciphertextHandleBlock).not.toMatch(/derive\(.*Clone/);
  });

  it("4. structural: Cargo.toml already carries wasm-bindgen and k256's schnorr feature, and serde is dev-only", () => {
    expect(cargoTomlSource).toMatch(/wasm-bindgen = "0\.2\.126"/);
    expect(cargoTomlSource).toMatch(/features = \["arithmetic", "schnorr"\]/);
    const devDepsIndex = cargoTomlSource.indexOf("[dev-dependencies]");
    const depsIndex = cargoTomlSource.indexOf("[dependencies]");
    const prodDepsSection = cargoTomlSource.slice(depsIndex, devDepsIndex);
    expect(prodDepsSection).not.toMatch(/^serde/m);
  });

  it("5. structural: mod master_root contains no #[wasm_bindgen] attribute anywhere in its own body", () => {
    const startIndex = libRsSource.indexOf("mod master_root {");
    expect(startIndex).toBeGreaterThan(0);
    const endIndex = libRsSource.indexOf("mod key_material", startIndex);
    expect(endIndex).toBeGreaterThan(startIndex);
    const moduleBody = libRsSource.slice(startIndex, endIndex);
    // Line-start-anchored -- Alpha 869 added a doc comment inside this
    // module that legitimately NAMES `` `#[wasm_bindgen]` `` in prose,
    // describing a helper this module owns as reachable FROM a real
    // wasm_bindgen-annotated caller defined elsewhere (outside this
    // module). An actually-applied attribute always starts its own line;
    // prose mentioning it does not.
    expect(moduleBody).not.toMatch(/^#\[wasm_bindgen\]/m);
  });

  it("6. structural: src/vault/types.ts documents itself as key-material-free", () => {
    expect(vaultTypesSource).toMatch(/NO key generation, NO key derivation, NO seed storage/);
  });

  it("7. structural: FedosRuntimeIdentity holds no cryptographic material field", () => {
    expect(runtimeIdentitySource).toMatch(/readonly #registry: FedosIdentityRegistry;/);
    expect(runtimeIdentitySource).toMatch(/readonly #service: FedosIdentityService;/);
    expect(runtimeIdentitySource).not.toMatch(/#seed/);
    expect(runtimeIdentitySource).not.toMatch(/#masterSeed/);
  });

  it("8. the design doc's own critical finding (§13) states no Master Seed authority exists", () => {
    expect(designDocSource).toMatch(
      /no real 32-byte Master Seed material exists anywhere\s*\nreachable at runtime, in Rust or TypeScript, today/,
    );
  });

  it("9. the design doc cross-references Alpha 421, Alpha 146, and Alpha 144", () => {
    for (const ref of [
      "secure_runtime_alpha_421_existing_nostr_outbound_construction_inventory",
      "secure_runtime_alpha_146_master_seed_handle",
      "secure_runtime_alpha_144_recovery_threat_model_decision",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // -----------------------------------------------------------------
  // Regression: zero code change anywhere
  // -----------------------------------------------------------------

  it("10. Regression: desktop_application.ts carries no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_422/);
  });
});
