import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_169_deterministic_nostr_public_key_derivation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Secure Runtime Alpha 169 -- "Deterministic Nostr Public Key Derivation":
 * Stage 4 of the Deterministic Nostr Public Key Derivation Arc. Adds
 * derive_nostr_public_key_internal (Nostr Secret Key -> Nostr Public Key),
 * via k256's own existing SecretKey::public_key(), no new dependency.
 */
describe("Secure Runtime Alpha 169 -- Deterministic Nostr Public Key Derivation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage modifying exactly one file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`packages\/fedos-core-rust\/src\/lib\.rs`, and nothing else — no `src\/`\s*\nfile is touched\./,
    );
  });

  it("3. structural: derive_nostr_public_key_internal exists with the exact signature the Objective named", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) fn derive_nostr_public_key_internal\(\s*\n\s*secret_key: &FedosNostrSecretKeyHandle,\s*\n\s*\) -> Option<FedosNostrPublicKeyHandle> \{/,
    );
  });

  it("4. structural: the function uses k256::SecretKey::public_key() and to_encoded_point(true).x() -- no manual point arithmetic, no new algorithm", () => {
    const fnMatch = libRsSource.match(/pub\(crate\) fn derive_nostr_public_key_internal\(([\s\S]*?)\r?\n {4}\}/);
    const fnBody = fnMatch?.[1] ?? "";
    expect(fnBody.length).toBeGreaterThan(0);
    expect(fnBody).toMatch(/sk\.public_key\(\)\.to_encoded_point\(true\)/);
    expect(fnBody).toMatch(/encoded\.x\(\)/);
  });

  it("5. structural: the secret scalar is reconstructed via SecretKey::from_slice, the same validation used elsewhere, and zeroized on every path", () => {
    const fnMatch = libRsSource.match(/pub\(crate\) fn derive_nostr_public_key_internal\(([\s\S]*?)\r?\n {4}\}/);
    const fnBody = fnMatch?.[1] ?? "";
    expect(fnBody).toMatch(/SecretKey::from_slice\(&secret_bytes\)/);
    expect(fnBody).toMatch(/secret_bytes\.zeroize\(\);/);
  });

  it("6. structural: the function accesses the secret key ONLY via the one new narrowly-scoped accessor, never a generic byte export", () => {
    expect(libRsSource).toMatch(
      /fn expose_bytes_for_internal_public_key_derivation\(&self\) -> Option<\[u8; 32\]> \{/,
    );
    const fnMatch = libRsSource.match(/pub\(crate\) fn derive_nostr_public_key_internal\(([\s\S]*?)\r?\n {4}\}/);
    const fnBody = fnMatch?.[1] ?? "";
    expect(fnBody).toMatch(/secret_key\.expose_bytes_for_internal_public_key_derivation\(\)\?/);
  });

  it("7. structural: no panic in the function body -- no unwrap/expect/panic!", () => {
    const fnMatch = libRsSource.match(/pub\(crate\) fn derive_nostr_public_key_internal\(([\s\S]*?)\r?\n {4}\}/);
    const fnBody = fnMatch?.[1] ?? "";
    expect(fnBody).not.toMatch(/\.unwrap\(\)/);
    expect(fnBody).not.toMatch(/\.expect\(/);
    expect(fnBody).not.toMatch(/panic!/);
  });

  it("8. structural: no raw byte is ever returned -- the function's own return type is Option<FedosNostrPublicKeyHandle>, never [u8; 32]", () => {
    const fnMatch = libRsSource.match(/pub\(crate\) fn derive_nostr_public_key_internal\(([\s\S]*?)\r?\n {4}\}/);
    const fnBody = fnMatch?.[1] ?? "";
    expect(fnBody).not.toMatch(/-> \[u8; 32\]/);
  });

  it("9. the design doc explains why a plain Option is used instead of a *Decision struct, unlike Alpha 164's own derive_nostr_secret_key_internal", () => {
    expect(designDocSource).toMatch(
      /plain `Option` already expresses that shape without an unused status\s*\nenum\./,
    );
  });

  it("10. the design doc cross-references Alpha 168, 167, 166, and 164", () => {
    for (const ref of [
      "secure_runtime_alpha_168_nostr_public_key_handle",
      "secure_runtime_alpha_167_nostr_public_key_representation_decision",
      "secure_runtime_alpha_166_existing_nostr_public_key_inventory",
      "secure_runtime_alpha_164_deterministic_nostr_secret_key_derivation",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("11. Regression: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(13);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(36);
  });

  it("12. Regression: desktop_application.ts and fedos_runtime_identity.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_169/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_169/);
  });

  it("13. Regression: worker.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_169/);
  });

  it("14. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_169/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_169/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
