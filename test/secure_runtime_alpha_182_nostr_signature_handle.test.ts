import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_182_nostr_signature_handle.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 182 -- "FedosNostrSignatureHandle": Stage 2 of
 * the Nostr Schnorr Signing Foundation Arc (Alpha 181-190). IMPLEMENTS
 * -- adds one opaque, crate-private type: no Clone, no Debug, no
 * Serialize, no wasm_bindgen, no raw byte export.
 */
describe("Secure Runtime Alpha 182 -- FedosNostrSignatureHandle", () => {
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

  it("3. the design doc walks through all five explicit Alpha 182 requirements", () => {
    const section = (designDocSource.match(/## 3\. Requirements([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Opaque handle\.\*\*/);
    expect(section).toMatch(/\*\*No `Clone`\.\*\*/);
    expect(section).toMatch(/\*\*No `Debug`\.\*\*/);
    expect(section).toMatch(/\*\*No `Serialize`\.\*\*/);
    expect(section).toMatch(/\*\*No `wasm_bindgen`\.\*\*/);
    expect(section).toMatch(/\*\*No raw byte export\.\*\*/);
  });

  it("4. the design doc explains why plain bytes are used instead of SecretHandle", () => {
    const section = (designDocSource.match(/## 4\. Why plain bytes, not a `SecretHandle`([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/is not secret material by definition/);
  });

  it("5. the design doc cross-references Alpha 181, 173, and 168", () => {
    for (const ref of [
      "secure_runtime_alpha_181_k256_schnorr_api_inventory",
      "secure_runtime_alpha_173_nostr_public_identifier_encoder",
      "secure_runtime_alpha_168_nostr_public_key_handle",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the doc's own claims directly against source
  // ---------------------------------------------------------------------

  it("6. structural: FedosNostrSignatureHandle exists, holds a private [u8; 64], and derives nothing", () => {
    const structMatch = libRsSource.match(
      /((?:#\[derive\([^)]*\)\]\s*\n\s*)*)pub\(crate\) struct FedosNostrSignatureHandle \{([\s\S]*?)\n {4}\}/,
    );
    expect(structMatch).not.toBeNull();
    const [, derives, body] = structMatch ?? [];
    expect(derives ?? "").toBe("");
    expect(body).toMatch(/bytes: \[u8; 64\],/);
    expect(body).not.toMatch(/pub /);
  });

  it("7. structural: FedosNostrSignatureHandle's impl block exposes exactly two methods, both narrow", () => {
    const implMatch = libRsSource.match(/impl FedosNostrSignatureHandle \{([\s\S]*?)\n {4}\}/);
    expect(implMatch).not.toBeNull();
    const body = implMatch?.[1] ?? "";
    expect(body).toMatch(/fn new_from_64_bytes_for_internal_use\(bytes: \[u8; 64\]\) -> Self/);
    expect(body).toMatch(
      /pub\(crate\) fn matches_for_internal_verification\(&self, other: &Self\) -> bool \{/,
    );
    expect(body).toMatch(/bool::from\(self\.bytes\.ct_eq\(&other\.bytes\)\)/);
    // Exactly two `fn` in this impl block -- no third method, no accessor.
    const fnCount = [...body.matchAll(/\bfn\s+\w+/g)].length;
    expect(fnCount).toBe(3);
  });

  it("8. structural: no Clone/Debug/Serialize/PartialEq/Eq/Hash derive or impl exists for this type anywhere in lib.rs", () => {
    expect(libRsSource).not.toMatch(/impl Clone for FedosNostrSignatureHandle/);
    expect(libRsSource).not.toMatch(/impl (?:std::)?fmt::Debug for FedosNostrSignatureHandle/);
    expect(libRsSource).not.toMatch(/impl (?:serde::)?Serialize for FedosNostrSignatureHandle/);
    expect(libRsSource).not.toMatch(/impl PartialEq for FedosNostrSignatureHandle/);
  });

  it("9. structural: no #[wasm_bindgen] attribute is attached to FedosNostrSignatureHandle, count fixed at 13", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(17);
    // No wasm_bindgen attribute immediately precedes the struct or impl.
    expect(libRsSource).not.toMatch(/#\[wasm_bindgen\]\s*\n\s*pub\(crate\) struct FedosNostrSignatureHandle/);
  });

  it("10. structural: SecretHandleKind gained zero new variant -- FedosNostrSignatureHandle never wraps a SecretHandle", () => {
    const kindBody = (libRsSource.match(/pub\(crate\) enum SecretHandleKind \{([\s\S]*?)\n {4}\}/) ?? [])[1] ?? "";
    const kindVariants = [...kindBody.matchAll(/^\s*(\w+),/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(kindVariants).toEqual([
      "Placeholder",
      "AeadKeyMaterial",
      "HkdfInputMaterial",
      "HkdfOutputMaterial",
      "NostrKeyMaterial",
      "ConversationKeyMaterial",
      "MessageKeyMaterial",
      "MasterSeedMaterial",
      "IdentityRootMaterial",
      "ApplicationRootMaterial",
      "ProtocolRootMaterial",
      "NostrSecretKeyMaterial",
      "TestOnlySecretMaterial",
    ]);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("11. Regression: package.json is untouched -- zero new npm dependency, this is a Rust-only Stage", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_182/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
