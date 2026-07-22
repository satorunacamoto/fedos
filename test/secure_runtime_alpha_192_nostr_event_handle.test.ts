import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_192_nostr_event_handle.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 192 -- "FedosNostrEventHandle": Stage 2 of the
 * Nostr Event Foundation Arc (Alpha 191-200). IMPLEMENTS -- adds one
 * opaque, crate-private type plus its own smart constructor: no
 * Clone, no Debug, no Serialize, no wasm_bindgen, no raw JSON export.
 */
describe("Secure Runtime Alpha 192 -- FedosNostrEventHandle", () => {
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

  it("3. the design doc walks through all six explicit requirements", () => {
    const section = (designDocSource.match(/## 3\. Requirements([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Opaque\.\*\*/);
    expect(section).toMatch(/\*\*No `Clone`\.\*\*/);
    expect(section).toMatch(/\*\*No `Debug`\.\*\*/);
    expect(section).toMatch(/\*\*No `Serialize`\.\*\*/);
    expect(section).toMatch(/\*\*No `wasm_bindgen`\.\*\*/);
    expect(section).toMatch(/\*\*No raw JSON export\.\*\*/);
  });

  it("4. the design doc explains the smart constructor reuses the existing Identifier Encoder", () => {
    const section = (designDocSource.match(/## 4\. The smart constructor([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/never\s*\ncomputes a Nostr public key's own hex form two independent ways/);
    expect(section).toMatch(/ALWAYS Some today/);
  });

  it("5. the design doc cross-references Alpha 191, 182, 173, and 168", () => {
    for (const ref of [
      "secure_runtime_alpha_191_nostr_event_model_inventory",
      "secure_runtime_alpha_182_nostr_signature_handle",
      "secure_runtime_alpha_173_nostr_public_identifier_encoder",
      "secure_runtime_alpha_168_nostr_public_key_handle",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the doc's own claims directly against source
  // ---------------------------------------------------------------------

  it("6. structural: FedosNostrEventHandle exists, holds five private fields, and derives nothing", () => {
    const structMatch = libRsSource.match(
      /((?:#\[derive\([^)]*\)\]\s*\r?\n\s*)*)pub\(crate\) struct FedosNostrEventHandle \{([\s\S]*?)\r?\n {4}\}/,
    );
    expect(structMatch).not.toBeNull();
    const [, derives, body] = structMatch ?? [];
    expect(derives ?? "").toBe("");
    expect(body).toMatch(/pubkey: nostr_identifier_encoding::FedosNostrPublicKeyHex,/);
    expect(body).toMatch(/created_at: u64,/);
    expect(body).toMatch(/kind: u64,/);
    expect(body).toMatch(/tags: Vec<Vec<String>>,/);
    expect(body).toMatch(/content: String,/);
    expect(body).not.toMatch(/pub /);
  });

  it("7. structural: FedosNostrEventHandle's impl block exposes exactly two methods, neither pub(crate)", () => {
    const implMatch = libRsSource.match(/impl FedosNostrEventHandle \{([\s\S]*?)\r?\n {4}\}/);
    expect(implMatch).not.toBeNull();
    const body = implMatch?.[1] ?? "";
    expect(body).toMatch(/fn new_for_internal_use\(/);
    expect(body).toMatch(/fn expose_fields_for_internal_canonical_serialization\(/);
    expect(body).not.toMatch(/pub\(crate\) fn/);
    const fnCount = [...body.matchAll(/\bfn\s+\w+/g)].length;
    expect(fnCount).toBe(2);
  });

  it("8. structural: new_nostr_event_internal reuses encode_nostr_public_key_hex_internal and returns Option", () => {
    const fnMatch = libRsSource.match(
      /pub\(crate\) fn new_nostr_event_internal\([\s\S]*?\r?\n {4}\}\r?\n/,
    );
    expect(fnMatch).not.toBeNull();
    const body = fnMatch?.[0] ?? "";
    expect(body).toContain("-> Option<FedosNostrEventHandle>");
    expect(body).toContain("nostr_identifier_encoding::encode_nostr_public_key_hex_internal(pubkey)?");
    expect(body).not.toMatch(/\.unwrap\(\)|\.expect\(|panic!/);
  });

  it("9. structural: no Clone/Debug/Serialize/PartialEq/Eq/Hash derive or impl exists for this type anywhere in lib.rs", () => {
    expect(libRsSource).not.toMatch(/impl Clone for FedosNostrEventHandle/);
    expect(libRsSource).not.toMatch(/impl (?:std::)?fmt::Debug for FedosNostrEventHandle/);
    expect(libRsSource).not.toMatch(/impl (?:serde::)?Serialize for FedosNostrEventHandle/);
    expect(libRsSource).not.toMatch(/impl PartialEq for FedosNostrEventHandle/);
  });

  it("10. structural: no #[wasm_bindgen] attribute is attached to FedosNostrEventHandle, count fixed at 13", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(17);
    expect(libRsSource).not.toMatch(/#\[wasm_bindgen\]\s*\r?\n\s*pub\(crate\) struct FedosNostrEventHandle/);
  });

  it("11. structural: no &mut self method exists anywhere on FedosNostrEventHandle", () => {
    const implMatch = libRsSource.match(/impl FedosNostrEventHandle \{([\s\S]*?)\r?\n {4}\}/);
    const body = implMatch?.[1] ?? "";
    expect(body).not.toMatch(/&mut self/);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("12. Regression: package.json is untouched -- zero new npm dependency, this is a Rust-only Stage", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_192/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
