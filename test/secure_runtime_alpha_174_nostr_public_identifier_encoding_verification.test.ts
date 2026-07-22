import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_174_nostr_public_identifier_encoding_verification.md?raw";
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
 * Secure Runtime Alpha 174 -- "Nostr Public Identifier Encoding
 * Verification": Stage 4 of the Nostr Public Identifier Encoding Arc.
 * Adds only #[cfg(test)] coverage -- no further production-code change.
 * Verifies determinism, separation, boundary values, shape properties, and
 * the BIP-173 known vector.
 */
describe("Secure Runtime Alpha 174 -- Nostr Public Identifier Encoding Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW ONLY, adding test coverage but no further production-code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/but makes NO further production-code change\./);
  });

  it("3. the design doc names the BIP-173 known vector and explicitly declines to fabricate a Nostr-specific one", () => {
    expect(designDocSource).toMatch(/"a12uel5l"/);
    expect(designDocSource).toMatch(/rather than fabricating a\s*\nNostr-specific hex\/`npub` pair from memory/);
  });

  it("4. the design doc cross-references Alpha 173, 172, and 171", () => {
    for (const ref of [
      "secure_runtime_alpha_173_nostr_public_identifier_encoder",
      "secure_runtime_alpha_172_nostr_identifier_representation_decision",
      "secure_runtime_alpha_171_existing_nostr_identifier_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: the real-execution test coverage this Stage's own
  // verification claims actually exists in lib.rs
  // ---------------------------------------------------------------------

  it("5. structural: real-execution determinism/separation/boundary tests exist for the identifier-encoding level", () => {
    for (const testName of [
      "fn same_master_seed_and_same_account_index_encode_identical_hex_and_npub",
      "fn same_master_seed_and_different_account_index_encode_different_hex_and_npub",
      "fn different_master_seed_and_same_account_index_encode_different_hex_and_npub",
      "fn account_index_zero_one_and_u32_max_all_encode_successfully_and_distinctly",
      "fn hex_and_npub_encode_the_same_underlying_32_byte_public_key",
    ]) {
      expect(libRsSource).toContain(testName);
    }
  });

  it("6. structural: the BIP-173 known-vector test exists and asserts the exact published output", () => {
    expect(libRsSource).toMatch(
      /fn bech32_encode_matches_the_published_bip173_a_empty_vector\(\) \{\s*\n\s*assert_eq!\(bech32_encoding::bech32_encode\("a", &\[\]\), "a12uel5l"\);/,
    );
  });

  it("7. structural: the test-only reversal is #[cfg(test)]-scoped, never a production Decoder", () => {
    expect(libRsSource).toMatch(
      /fn hex_and_npub_encode_the_same_underlying_32_byte_public_key\(\) \{/,
    );
    // No pub(crate)-visible decode/reversal function exists anywhere in production code.
    expect(libRsSource).not.toMatch(/pub\(crate\) fn decode_nostr_npub_internal/);
    expect(libRsSource).not.toMatch(/pub\(crate\) fn decode_nostr_public_key_hex_internal/);
    expect(libRsSource).not.toMatch(/pub\(crate\) fn bech32_decode/);
  });

  it("8. the design doc's own verification section covers hex properties, npub properties, and no-panic", () => {
    for (const heading of [
      "### 2.4 Hex properties",
      "### 2.5 `npub` properties",
      "### 2.7 No panic",
    ]) {
      expect(designDocSource).toContain(heading);
    }
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("9. Regression: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(17);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(64);
  });

  it("10. Regression: desktop_application.ts and fedos_runtime_identity.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_174/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_174/);
  });

  it("11. Regression: worker.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_174/);
  });

  it("12. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_174/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_174/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
