import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_195_connect_event_id_to_schnorr_signing.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 195 -- "Connect Event ID Generation to the
 * Schnorr Signature Foundation": Stage 5 of the Nostr Event Foundation
 * Arc (Alpha 191-200). IMPLEMENTS -- the ONE function connecting
 * Alpha 194's Event ID to the EXISTING, UNCHANGED Alpha 183 signing
 * function. No Relay logic.
 */
describe("Secure Runtime Alpha 195 -- Connect Event ID Generation to Schnorr Signing", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself IMPLEMENTS, touching only lib.rs", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`packages\/fedos-core-rust\/src\/lib\.rs`/,
    );
  });

  it("3. the design doc confirms no Relay logic by describing what the function does NOT do", () => {
    const section = (designDocSource.match(/## 3\. "No Relay logic" — confirmed by what this function does NOT do([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/does not open a\s*\nnetwork connection, and does not publish or transmit anything/);
  });

  it("4. the design doc confirms derive_nostr_signature_internal is reused byte-for-byte unchanged", () => {
    const section = (designDocSource.match(/## 4\. Reuses `derive_nostr_signature_internal` completely unchanged([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/BYTE-FOR-BYTE\s*\nunchanged by this Stage/);
  });

  it("5. the design doc names the exact Alpha 196 end-to-end verification tests", () => {
    const section = (designDocSource.match(/## 6\. Structural confirmation([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    expect(section).toContain("signed_nostr_event_cryptographically_verifies_end_to_end");
    expect(section).toContain("signed_nostr_event_does_not_verify_against_a_different_events_id");
  });

  it("6. the design doc cross-references Alpha 194, 193, 192, 183, and 187", () => {
    for (const ref of [
      "secure_runtime_alpha_194_deterministic_event_id_generation",
      "secure_runtime_alpha_193_canonical_event_serialization",
      "secure_runtime_alpha_192_nostr_event_handle",
      "secure_runtime_alpha_183_derive_nostr_signature_internal",
      "secure_runtime_alpha_187_event_builder_compatibility_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the doc's own claims directly against source
  // ---------------------------------------------------------------------

  it("7. structural: sign_nostr_event_internal exists with the exact documented signature and two-statement body", () => {
    const fnMatch = libRsSource.match(
      /pub\(crate\) fn sign_nostr_event_internal\(\s*\r?\n\s*event: &FedosNostrEventHandle,\s*\r?\n\s*secret_key: &FedosNostrSecretKeyHandle,\s*\r?\n\s*\) -> Option<FedosNostrSignatureHandle> \{([\s\S]*?)\r?\n {4}\}\r?\n/,
    );
    expect(fnMatch).not.toBeNull();
    const body = fnMatch?.[1] ?? "";
    expect(body).toContain("let event_id = derive_nostr_event_id_internal(event)?;");
    expect(body).toContain("derive_nostr_signature_internal(secret_key, &event_id)");
    expect(body).not.toMatch(/\.unwrap\(\)|\.expect\(|panic!/);
  });

  it("8. structural: derive_nostr_signature_internal's own signature is byte-for-byte unchanged from Alpha 183", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) fn derive_nostr_signature_internal\(\s*\r?\n\s*secret_key: &FedosNostrSecretKeyHandle,\s*\r?\n\s*message: &\[u8; 32\],\s*\r?\n\s*\) -> Option<FedosNostrSignatureHandle> \{/,
    );
  });

  it("9. structural: FedosNostrEventHandle gained no new field or method from this Stage -- still exactly two methods", () => {
    const implMatch = libRsSource.match(/impl FedosNostrEventHandle \{([\s\S]*?)\r?\n {4}\}/);
    const body = implMatch?.[1] ?? "";
    const fnCount = [...body.matchAll(/\bfn\s+\w+/g)].length;
    expect(fnCount).toBe(2);
  });

  it("10. structural: wasm_bindgen count and pub fn count remain fixed at 13/36, unchanged by this Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(15);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(44);
  });

  it("11. structural: no Relay/WebSocket/publish/subscribe reference exists in sign_nostr_event_internal's own body", () => {
    const fnMatch = libRsSource.match(
      /pub\(crate\) fn sign_nostr_event_internal\([\s\S]*?\r?\n {4}\}\r?\n/,
    );
    const body = fnMatch?.[0] ?? "";
    expect(body).not.toMatch(/Relay|WebSocket|publish|subscribe/i);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("12. Regression: package.json is untouched -- zero new npm dependency, this is a Rust-only Stage", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_195/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
