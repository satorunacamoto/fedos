import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_437_seal_and_restore_implementation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRaw from "../packages/fedos-core-rust/src/lib.rs?raw";

const lib: string = (libRaw as string).replace(/\r\n/g, "\n");

const REQUIRED_TESTS = [
  "seal_succeeds_on_an_available_authority_and_never_reveals_the_seed_in_plaintext",
  "restore_sealed_round_trips_to_the_identical_signing_identity",
  "restore_sealed_with_the_wrong_passphrase_fails_closed_and_leaves_authority_empty",
  "restore_sealed_with_a_corrupted_ciphertext_fails_closed",
  "restore_sealed_with_an_unrecognized_schema_version_fails_closed",
  "restore_sealed_never_overwrites_an_already_available_authority",
  "clear_on_an_available_authority_prevents_further_signing",
  "restore_sealed_with_a_malformed_json_envelope_fails_closed_and_does_not_panic",
];

describe("Secure Runtime Alpha 437 -- Seal and Restore Implementation", () => {
  it("every required verification test is documented and actually exists in lib.rs", () => {
    for (const testName of REQUIRED_TESTS) {
      expect(doc).toContain(testName);
      expect(lib).toContain(`fn ${testName}(`);
    }
  });

  it("the malformed-envelope test asserts no panic on empty, non-JSON, and empty-object input", () => {
    const testBody = (lib.match(
      /fn restore_sealed_with_a_malformed_json_envelope_fails_closed_and_does_not_panic\(\) \{[\s\S]*?\n    \}/,
    ) ?? [""])[0];
    expect(testBody).toContain('"not json at all"');
    expect(testBody).toContain('""');
    expect(testBody).toContain('"{}"');
  });

  it("this Stage is NOT a stop-and-report Stage", () => {
    expect(doc).toMatch(/Nothing — every requirement/);
  });
});
