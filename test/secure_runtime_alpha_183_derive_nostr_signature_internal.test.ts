import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_183_derive_nostr_signature_internal.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 183 -- "derive_nostr_signature_internal()":
 * Stage 3 of the Nostr Schnorr Signing Foundation Arc (Alpha 181-190).
 * IMPLEMENTS -- the one function that computes a real, deterministic
 * BIP-340 signature via k256::schnorr, no manual crypto.
 */
describe("Secure Runtime Alpha 183 -- derive_nostr_signature_internal()", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself IMPLEMENTS, touching only lib.rs", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`packages\/fedos-core-rust\/src\/lib\.rs`/,
    );
  });

  it("3. the design doc states message is a 32-byte prehash matching NIP-01", () => {
    const section = (designDocSource.match(/## 3\. `message` is a 32-byte digest, matching NIP-01 exactly([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/never hashes its own input/);
  });

  it("4. the design doc's Fail Closed table covers all four conditions", () => {
    const section = (designDocSource.match(/## 5\. Fail Closed([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toContain("already `clear()`-ed");
    expect(section).toContain("rejects the candidate bytes");
    expect(section).toContain("`sign_prehash` itself returns `Err`");
    expect(section).toContain("`Some(FedosNostrSignatureHandle)`");
  });

  it("5. the design doc cross-references Alpha 182, 181, 169, and 164", () => {
    for (const ref of [
      "secure_runtime_alpha_182_nostr_signature_handle",
      "secure_runtime_alpha_181_k256_schnorr_api_inventory",
      "secure_runtime_alpha_169_deterministic_nostr_public_key_derivation",
      "secure_runtime_alpha_164_deterministic_nostr_secret_key_derivation",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the doc's own claims directly against source
  // ---------------------------------------------------------------------

  it("6. structural: derive_nostr_signature_internal exists with the exact documented signature", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) fn derive_nostr_signature_internal\(\s*\n\s*secret_key: &FedosNostrSecretKeyHandle,\s*\n\s*message: &\[u8; 32\],\s*\n\s*\) -> Option<FedosNostrSignatureHandle> \{/,
    );
  });

  it("7. structural: the function body contains zero unwrap/expect/panic/todo/unimplemented", () => {
    const fnMatch = libRsSource.match(
      /pub\(crate\) fn derive_nostr_signature_internal\([\s\S]*?\r?\n {4}\}\r?\n/,
    );
    expect(fnMatch).not.toBeNull();
    const body = fnMatch?.[0] ?? "";
    expect(body).not.toMatch(/\.unwrap\(\)|\.expect\(|panic!|todo!|unimplemented!/);
  });

  it("8. structural: the function calls only k256::schnorr's own SigningKey API -- no hand-rolled Scalar/FieldElement arithmetic", () => {
    const fnMatch = libRsSource.match(
      /pub\(crate\) fn derive_nostr_signature_internal\([\s\S]*?\r?\n {4}\}\r?\n/,
    );
    const body = fnMatch?.[0] ?? "";
    expect(body).toContain("SchnorrSigningKey::from_bytes");
    expect(body).toContain(".sign_prehash(message)");
    expect(body).toContain(".to_bytes()");
    expect(body).not.toMatch(/\bScalar\b|\bFieldElement\b|\bProjectivePoint\b/);
  });

  it("9. structural: the transient secret byte copy is zeroized before returning", () => {
    const fnMatch = libRsSource.match(
      /pub\(crate\) fn derive_nostr_signature_internal\([\s\S]*?\r?\n {4}\}\r?\n/,
    );
    const body = fnMatch?.[0] ?? "";
    expect(body).toMatch(/secret_bytes\.zeroize\(\);/);
  });

  it("10. structural: a dedicated expose_bytes_for_internal_signing accessor exists on FedosNostrSecretKeyHandle", () => {
    expect(libRsSource).toMatch(
      /fn expose_bytes_for_internal_signing\(&self\) -> Option<\[u8; 32\]> \{\s*\n\s*self\.inner\.expose_bytes_for_internal_derivation\(\)\s*\n\s*\}/,
    );
  });

  it("11. structural: wasm_bindgen count and pub fn count remain fixed at 13/36, unchanged by this Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(13);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(36);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("12. Regression: package.json is untouched -- zero new npm dependency, this is a Rust-only Stage", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_183/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
