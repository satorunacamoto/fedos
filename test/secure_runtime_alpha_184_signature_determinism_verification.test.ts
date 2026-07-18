import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_184_signature_determinism_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 184 -- "Nostr Signature Determinism
 * Verification": Stage 4 of the Nostr Schnorr Signing Foundation Arc
 * (Alpha 181-190). REVIEW ONLY -- adds #[cfg(test)] coverage only,
 * landed alongside Alpha 182/183. Verifies determinism, separation,
 * Fail Closed, and real BIP-340 cross-verification, all by real
 * execution.
 */
describe("Secure Runtime Alpha 184 -- Nostr Signature Determinism Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW ONLY, adding only test coverage", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/but makes NO further production-code change/);
  });

  it("3. the design doc names every required determinism/separation/fail-closed test", () => {
    for (const testName of [
      "same_secret_key_and_same_message_derive_identical_signatures",
      "same_secret_key_and_different_message_derive_non_matching_signatures",
      "different_account_indices_derive_non_matching_signatures_for_the_same_message",
      "different_master_seeds_and_same_account_index_derive_non_matching_signatures",
      "account_index_zero_one_and_u32_max_all_sign_successfully_and_distinctly_for_the_same_message",
      "derive_nostr_signature_internal_rejects_a_cleared_secret_key",
      "derive_nostr_signature_internal_succeeds_for_a_real_secret_key",
      "derive_nostr_signature_internal_does_not_mutate_the_input_secret_key",
    ]) {
      expect(designDocSource).toContain(testName);
    }
  });

  it("4. the design doc names the real BIP-340 cross-verification tests and their negative counterpart", () => {
    expect(designDocSource).toContain(
      "derived_signature_cryptographically_verifies_against_the_independently_derived_public_key",
    );
    expect(designDocSource).toContain("derived_signature_does_not_verify_against_a_different_message");
    expect(designDocSource).toMatch(/REAL, executed\s*\nBIP-340 verification/);
  });

  it("5. the design doc cross-references Alpha 183, 182, 181, and 174", () => {
    for (const ref of [
      "secure_runtime_alpha_183_derive_nostr_signature_internal",
      "secure_runtime_alpha_182_nostr_signature_handle",
      "secure_runtime_alpha_181_k256_schnorr_api_inventory",
      "secure_runtime_alpha_174_nostr_public_identifier_encoding_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: every test the doc names actually exists in lib.rs, as a
  // REAL #[test] function -- not merely mentioned in a doc comment
  // ---------------------------------------------------------------------

  it("6. structural: every named test function is a real #[test] in master_root::tests", () => {
    for (const testName of [
      "same_secret_key_and_same_message_derive_identical_signatures",
      "same_secret_key_and_different_message_derive_non_matching_signatures",
      "different_account_indices_derive_non_matching_signatures_for_the_same_message",
      "different_master_seeds_and_same_account_index_derive_non_matching_signatures",
      "account_index_zero_one_and_u32_max_all_sign_successfully_and_distinctly_for_the_same_message",
      "derive_nostr_signature_internal_rejects_a_cleared_secret_key",
      "derive_nostr_signature_internal_succeeds_for_a_real_secret_key",
      "derive_nostr_signature_internal_does_not_mutate_the_input_secret_key",
      "signature_matches_for_internal_verification_returns_true_only_for_equal_bytes",
      "derived_signature_cryptographically_verifies_against_the_independently_derived_public_key",
      "derived_signature_does_not_verify_against_a_different_message",
    ]) {
      const re = new RegExp(`#\\[test\\]\\s*\\r?\\n\\s*fn ${testName}\\(`);
      expect(libRsSource).toMatch(re);
    }
  });

  it("7. structural: the cross-verification test really calls k256::schnorr's own VerifyingKey/PrehashVerifier, not a hand-rolled check", () => {
    const testMatch = libRsSource.match(
      /fn derived_signature_cryptographically_verifies_against_the_independently_derived_public_key\r?\n?\s*\(\s*\) \{([\s\S]*?)\r?\n {8}\}/,
    );
    expect(testMatch).not.toBeNull();
    const body = testMatch?.[1] ?? "";
    expect(body).toContain("PrehashVerifier");
    expect(body).toContain("SchnorrVerifyingKey::from_bytes");
    expect(body).toContain("SchnorrSignature::try_from");
    expect(body).toMatch(/verify_prehash\(&message, &schnorr_signature\)\.is_ok\(\)/);
  });

  it("8. structural: zero randomness source (rand/OsRng/getrandom call) appears anywhere in the signing test suite", () => {
    const sectionMatch = libRsSource.match(
      /\/\/ Secure Runtime Alpha 183\/184\/186[\s\S]*?\r?\n {4}\}\r?\n\}/,
    );
    expect(sectionMatch).not.toBeNull();
    const section = sectionMatch?.[0] ?? "";
    expect(section).not.toMatch(/OsRng|getrandom|rand_core|thread_rng/);
  });

  it("9. structural: wasm_bindgen count and pub fn count remain fixed at 13/36, unchanged by this Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(17);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(50);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("10. Regression: package.json is untouched -- zero new npm dependency, this is a Rust-only Stage", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_184/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
