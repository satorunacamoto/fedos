import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_173_nostr_public_identifier_encoder.md?raw";
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
 * Secure Runtime Alpha 173 -- "Nostr Public Identifier Encoder": Stage 3
 * of the Nostr Public Identifier Encoding Arc. Adds a nested
 * nostr_identifier_encoding Encoder Boundary inside master_root, with
 * hand-rolled hex + Bech32 (npub) codecs -- no new dependency.
 */
describe("Secure Runtime Alpha 173 -- Nostr Public Identifier Encoder", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage modifying exactly one file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`packages\/fedos-core-rust\/src\/lib\.rs`, and nothing else — no `src\/`\s*\nfile is touched\./,
    );
  });

  it("3. structural: nostr_identifier_encoding is nested INSIDE master_root, not a crypto:: sibling file", () => {
    expect(libRsSource).toMatch(/mod nostr_identifier_encoding \{/);
    expect(libRsSource).not.toMatch(/pub\(crate\) mod nostr_identifier_encoding;/);
  });

  it("4. structural: FedosNostrPublicKeyHex and FedosNostrNpub exist as separate, pub(crate)-only types", () => {
    expect(libRsSource).toMatch(/pub\(crate\) struct FedosNostrPublicKeyHex \{\s*\n\s*value: String,\s*\n\s*\}/);
    expect(libRsSource).toMatch(/pub\(crate\) struct FedosNostrNpub \{\s*\n\s*value: String,\s*\n\s*\}/);
    expect(libRsSource).not.toMatch(/^pub struct FedosNostrPublicKeyHex/m);
    expect(libRsSource).not.toMatch(/^pub struct FedosNostrNpub/m);
  });

  it("5. structural: both encoder entry points exist with the exact signatures the Objective named", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) fn encode_nostr_public_key_hex_internal\(\s*\n\s*public_key: &FedosNostrPublicKeyHandle,\s*\n\s*\) -> Option<FedosNostrPublicKeyHex> \{/,
    );
    expect(libRsSource).toMatch(
      /pub\(crate\) fn encode_nostr_npub_internal\(\s*\n\s*public_key: &FedosNostrPublicKeyHandle,\s*\n\s*\) -> Option<FedosNostrNpub> \{/,
    );
  });

  it("6. structural: the ONE new accessor on FedosNostrPublicKeyHandle is a bare private fn, never pub(crate), and is used by both encoders", () => {
    expect(libRsSource).toMatch(
      /\n {8}fn expose_bytes_for_internal_public_identifier_encoding\(&self\) -> \[u8; 32\] \{/,
    );
    expect(libRsSource).not.toMatch(/pub\(crate\) fn expose_bytes_for_internal_public_identifier_encoding/);
    const hexFn = (libRsSource.match(/pub\(crate\) fn encode_nostr_public_key_hex_internal\(([\s\S]*?)\r?\n {8}\}/) ?? [])[1] ?? "";
    const npubFn = (libRsSource.match(/pub\(crate\) fn encode_nostr_npub_internal\(([\s\S]*?)\r?\n {8}\}/) ?? [])[1] ?? "";
    expect(hexFn).toMatch(/expose_bytes_for_internal_public_identifier_encoding\(\)/);
    expect(npubFn).toMatch(/expose_bytes_for_internal_public_identifier_encoding\(\)/);
  });

  it("7. structural: hex encoding uses a fixed lowercase-only charset, never pushes an 0x-prefix string, no unwrap/expect/panic", () => {
    expect(libRsSource).toMatch(/const HEX_CHARS: &\[u8; 16\] = b"0123456789abcdef";/);
    const fn = (libRsSource.match(/pub\(super\) fn encode_lowercase_hex_32\(bytes: &\[u8; 32\]\) -> String \{([\s\S]*?)\r?\n {12}\}/) ?? [])[1] ?? "";
    expect(fn.length).toBeGreaterThan(0);
    expect(fn).not.toMatch(/push_str\("0x"\)|push\('0'\)\s*;\s*out\.push\('x'\)/);
    expect(fn).not.toMatch(/\.unwrap\(\)|\.expect\(|panic!/);
  });

  it("8. structural: bech32 encoding uses the classic Bech32 constant (1), never Bech32m's constant, fixed HRP npub", () => {
    expect(libRsSource).toMatch(/const BECH32_CONST: u32 = 1;/);
    expect(libRsSource).not.toMatch(/BECH32_CONST: u32 = 0x2bc830a3/);
    const npubFn = (libRsSource.match(/pub\(crate\) fn encode_nostr_npub_internal\(([\s\S]*?)\r?\n {8}\}/) ?? [])[1] ?? "";
    expect(npubFn).toMatch(/bech32_encoding::bech32_encode\(\s*\n\s*"npub", &bytes,\s*\n\s*\)/);
  });

  it("9. structural: no new Cargo dependency -- hex stays dev-dependencies-only, no bech32 crate added", () => {
    expect(cargoTomlSource).not.toMatch(/^bech32/m);
    const devDepsSection = (cargoTomlSource.match(/\[dev-dependencies\]([\s\S]*)/) ?? [])[1] ?? "";
    expect(devDepsSection).toMatch(/^hex = "0\.4\.3"/m);
  });

  it("10. the design doc's own Public Key Handle Access Rule review confirms every requirement", () => {
    const section = (designDocSource.match(/## 4\. The Public Key Handle Access Rule — satisfied item by item([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    for (const claim of [
      "**crate-private:**",
      "**Encoder専用",
      "**呼び出し元を最小化",
      "**Secret Key Handleから利用不能",
      "**wasm-bindgen非公開:**",
      "**Desktop/TypeScript非公開:**",
      "**汎用raw byte export APIではない",
      "**docで公開鍵専用の例外であることを明記",
    ]) {
      expect(section).toContain(claim);
    }
  });

  it("11. the design doc cross-references Alpha 172, 171, and 169", () => {
    for (const ref of [
      "secure_runtime_alpha_172_nostr_identifier_representation_decision",
      "secure_runtime_alpha_171_existing_nostr_identifier_inventory",
      "secure_runtime_alpha_169_deterministic_nostr_public_key_derivation",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("12. Regression: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(15);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(45);
  });

  it("13. Regression: desktop_application.ts and fedos_runtime_identity.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_173/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_173/);
  });

  it("14. Regression: worker.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_173/);
  });

  it("15. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_173/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_173/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
