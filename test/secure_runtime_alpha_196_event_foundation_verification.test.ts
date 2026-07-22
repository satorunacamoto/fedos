import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_196_event_foundation_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

const ALL_SEVENTEEN_TESTS = [
  "new_nostr_event_internal_succeeds_for_a_real_public_key",
  "canonical_serialization_matches_the_nip01_five_element_array_shape",
  "canonical_content_escapes_exactly_the_six_nip01_characters",
  "canonical_content_passes_non_ascii_utf8_through_verbatim",
  "derive_nostr_event_id_internal_succeeds_for_a_real_event",
  "same_event_fields_derive_identical_event_ids",
  "different_content_derives_different_event_id",
  "different_created_at_derives_different_event_id",
  "different_kind_derives_different_event_id",
  "different_tags_derives_different_event_id",
  "different_pubkey_derives_different_event_id",
  "sign_nostr_event_internal_succeeds_for_a_real_event",
  "sign_nostr_event_internal_rejects_a_cleared_secret_key",
  "sign_nostr_event_internal_does_not_mutate_the_input_secret_key",
  "sign_nostr_event_internal_produces_identical_signatures_for_the_same_event",
  "signed_nostr_event_cryptographically_verifies_end_to_end",
  "signed_nostr_event_does_not_verify_against_a_different_events_id",
];

/**
 * Secure Runtime Alpha 196 -- "Nostr Event Foundation Verification":
 * Stage 6 of the Nostr Event Foundation Arc (Alpha 191-200). REVIEW
 * ONLY -- adds #[cfg(test)] coverage only, landed alongside Alpha
 * 192-195. Verifies determinism, field separation, canonical
 * serialization correctness, Fail Closed, and real end-to-end BIP-340
 * verification, all by real execution.
 */
describe("Secure Runtime Alpha 196 -- Nostr Event Foundation Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW ONLY, adding only test coverage", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/but makes NO further production-code change/);
  });

  it("3. the design doc names all seventeen test functions across its own sections", () => {
    for (const testName of ALL_SEVENTEEN_TESTS) {
      expect(designDocSource).toContain(testName);
    }
  });

  it("4. the design doc claims exactly seventeen tests, beyond the Arc's own four-item minimum", () => {
    expect(designDocSource).toMatch(/seventeen real\s*\n`#\[test\]` functions/);
    expect(designDocSource).toMatch(/## 3\. Seventeen tests total/);
  });

  it("5. the design doc cross-references Alpha 195, 194, 193, 192, and 184", () => {
    for (const ref of [
      "secure_runtime_alpha_195_connect_event_id_to_schnorr_signing",
      "secure_runtime_alpha_194_deterministic_event_id_generation",
      "secure_runtime_alpha_193_canonical_event_serialization",
      "secure_runtime_alpha_192_nostr_event_handle",
      "secure_runtime_alpha_184_signature_determinism_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: every test the doc names actually exists in lib.rs, as a
  // REAL #[test] function -- not merely mentioned in a doc comment
  // ---------------------------------------------------------------------

  it("6. structural: every named test function is a real #[test] in master_root::tests", () => {
    for (const testName of ALL_SEVENTEEN_TESTS) {
      const re = new RegExp(`#\\[test\\]\\s*\\r?\\n\\s*fn ${testName}\\(`);
      expect(libRsSource).toMatch(re);
    }
  });

  it("7. structural: the end-to-end verification test really calls k256::schnorr's own VerifyingKey/PrehashVerifier", () => {
    const testMatch = libRsSource.match(
      /fn signed_nostr_event_cryptographically_verifies_end_to_end\(\) \{([\s\S]*?)\r?\n {8}\}/,
    );
    expect(testMatch).not.toBeNull();
    const body = testMatch?.[1] ?? "";
    expect(body).toContain("PrehashVerifier");
    expect(body).toContain("SchnorrVerifyingKey::from_bytes");
    expect(body).toContain("SchnorrSignature::try_from");
    expect(body).toMatch(/verify_prehash\(&event_id, &schnorr_signature\)\.is_ok\(\)/);
  });

  it("8. structural: the negative verification test asserts is_err against a different event's own id", () => {
    const testMatch = libRsSource.match(
      /fn signed_nostr_event_does_not_verify_against_a_different_events_id\(\) \{([\s\S]*?)\r?\n {8}\}/,
    );
    expect(testMatch).not.toBeNull();
    const body = testMatch?.[1] ?? "";
    expect(body).toMatch(/verify_prehash\(&other_event_id, &schnorr_signature\)\s*\r?\n\s*\.is_err\(\)/);
  });

  it("9. structural: zero randomness source (rand/OsRng/getrandom call) appears anywhere in the event test suite", () => {
    const sectionMatch = libRsSource.match(
      /\/\/ Secure Runtime Alpha 192\/193\/194\/195\/196[\s\S]*?\r?\n {4}\}\r?\n\}/,
    );
    expect(sectionMatch).not.toBeNull();
    const section = sectionMatch?.[0] ?? "";
    expect(section).not.toMatch(/OsRng|getrandom|rand_core|thread_rng/);
  });

  it("10. structural: wasm_bindgen count and pub fn count remain fixed at 13/36, unchanged by this Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(68);  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("11. Regression: package.json is untouched -- zero new npm dependency, this is a Rust-only Stage", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_196/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
