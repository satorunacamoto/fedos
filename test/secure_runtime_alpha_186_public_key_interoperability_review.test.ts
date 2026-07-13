import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_186_public_key_interoperability_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 186 -- "Interoperability with
 * FedosNostrPublicKeyHandle": Stage 6 of the Nostr Schnorr Signing
 * Foundation Arc (Alpha 181-190). REVIEW ONLY -- zero code change.
 * Confirms, citing Alpha 184's own real-execution tests, that
 * derive_nostr_signature_internal and the UNMODIFIED
 * derive_nostr_public_key_internal agree on the x-only convention.
 */
describe("Secure Runtime Alpha 186 -- Interoperability with FedosNostrPublicKeyHandle", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW ONLY", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change of any\s*\nkind/);
  });

  it("3. the design doc names the exact even/odd-Y x-only convention risk", () => {
    const section = (designDocSource.match(/## 2\. The convention risk this Stage specifically checks([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(/even Y and one with odd Y/);
    expect(section).toContain("to_encoded_point(true)");
  });

  it("4. the design doc cites k256's own conditional_assign correction, added by k256 not this Arc", () => {
    const section = (designDocSource.match(/## 3\. k256's own correction([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toContain("conditional_assign(&-secret_key, odd)");
    expect(section).toMatch(/Alpha 183 added zero\s*\ncorrection code of its own/);
  });

  it("5. the design doc cites the exact Alpha 184 cross-verification tests as its own primary evidence", () => {
    const section = (designDocSource.match(/## 4\. Real, executed cross-verification([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toContain(
      "derived_signature_cryptographically_verifies_against_the_independently_derived_public_key",
    );
    expect(section).toContain("derived_signature_does_not_verify_against_a_different_message");
    expect(section).toMatch(/NOT realized, by execution/);
  });

  it("6. the design doc confirms the two Handle types share no Rust type, trait, or field", () => {
    const section = (designDocSource.match(/## 5\. What remains genuinely independent([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/share no Rust type, no\s*\n\s*common trait, no common field/);
  });

  it("7. the design doc cross-references Alpha 185, 184, 169, and 168", () => {
    for (const ref of [
      "secure_runtime_alpha_185_signature_boundary_review",
      "secure_runtime_alpha_184_signature_determinism_verification",
      "secure_runtime_alpha_169_deterministic_nostr_public_key_derivation",
      "secure_runtime_alpha_168_nostr_public_key_handle",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm derive_nostr_public_key_internal (Alpha 169) is
  // completely unmodified by this Arc, and the cited tests are real
  // ---------------------------------------------------------------------

  it("8. structural: derive_nostr_public_key_internal remains byte-for-byte the naive x-only extraction this doc describes", () => {
    expect(libRsSource).toMatch(
      /let encoded = sk\.public_key\(\)\.to_encoded_point\(true\);/,
    );
    expect(libRsSource).not.toMatch(/conditional_assign/);
  });

  it("9. structural: both cross-verification tests exist as real #[test] functions", () => {
    for (const testName of [
      "derived_signature_cryptographically_verifies_against_the_independently_derived_public_key",
      "derived_signature_does_not_verify_against_a_different_message",
    ]) {
      const re = new RegExp(`#\\[test\\]\\s*\\r?\\n\\s*fn ${testName}\\(`);
      expect(libRsSource).toMatch(re);
    }
  });

  it("10. structural: FedosNostrPublicKeyHandle and FedosNostrSignatureHandle never reference each other's type in CODE (doc comments cross-referencing the sibling type for documentation are expected and excluded)", () => {
    const stripDocComments = (text: string): string =>
      text
        .split(/\r?\n/)
        .filter((line: string) => !line.trim().startsWith("///") && !line.trim().startsWith("//"))
        .join("\n");
    const publicKeyStruct = libRsSource.match(/pub\(crate\) struct FedosNostrPublicKeyHandle \{([\s\S]*?)\r?\n {4}\}/);
    const publicKeyImpl = libRsSource.match(/impl FedosNostrPublicKeyHandle \{([\s\S]*?)\r?\n {4}\}/);
    const signatureStruct = libRsSource.match(/pub\(crate\) struct FedosNostrSignatureHandle \{([\s\S]*?)\r?\n {4}\}/);
    const signatureImpl = libRsSource.match(/impl FedosNostrSignatureHandle \{([\s\S]*?)\r?\n {4}\}/);
    const publicKeyCode = stripDocComments((publicKeyStruct?.[1] ?? "") + (publicKeyImpl?.[1] ?? ""));
    const signatureCode = stripDocComments((signatureStruct?.[1] ?? "") + (signatureImpl?.[1] ?? ""));
    expect(publicKeyCode).not.toContain("FedosNostrSignatureHandle");
    expect(signatureCode).not.toContain("FedosNostrPublicKeyHandle");
  });

  it("11. structural: wasm_bindgen count remains fixed at 13, unchanged by this REVIEW-ONLY Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(13);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("12. Regression: lib.rs carries no reference to this Stage's own doc -- confirming zero further change", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_186/);
  });

  it("13. Regression: package.json is untouched", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_186/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
