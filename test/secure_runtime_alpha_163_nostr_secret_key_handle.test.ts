import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_163_nostr_secret_key_handle.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 163 -- "Nostr Secret Key Handle": Stage 3 of the
 * Deterministic Nostr Secret Key Derivation Arc. Adds the opaque
 * FedosNostrSecretKeyHandle type and the SecretHandleKind::NostrSecretKeyMaterial
 * variant.
 */
describe("Secure Runtime Alpha 163 -- Nostr Secret Key Handle", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage modifying exactly one file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`packages\/fedos-core-rust\/src\/lib\.rs`, and nothing else — no `src\/`\s*\nfile is touched\./,
    );
  });

  it("3. structural: FedosNostrSecretKeyHandle exists, wraps a SecretHandle, and is pub(crate) only", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) struct FedosNostrSecretKeyHandle \{\s*\n\s*inner: SecretHandle,\s*\n\s*\}/,
    );
    expect(libRsSource).not.toMatch(/^pub struct FedosNostrSecretKeyHandle/m);
  });

  it("4. structural: NostrSecretKeyMaterial is a real SecretHandleKind variant, distinct from the pre-existing NostrKeyMaterial", () => {
    const enumBody = (libRsSource.match(/pub\(crate\) enum SecretHandleKind \{([\s\S]*?)\n {4}\}/) ?? [])[1] ?? "";
    expect(enumBody).toMatch(/NostrSecretKeyMaterial,/);
    expect(enumBody).toMatch(/NostrKeyMaterial,/);
    const variants = [...enumBody.matchAll(/^\s*(\w+),/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(new Set(variants).size).toBe(variants.length);
  });

  it("5. RIPPLE (Secure Runtime Alpha 169): FedosNostrSecretKeyHandle exposed kind/is_cleared/clear/matches_for_internal_verification with NO byte-returning accessor of any kind AS OF this Stage's own closing state; Stage 1023 (Secure Runtime Alpha 169) legitimately added ONE private (never pub(crate)), single-caller accessor, expose_bytes_for_internal_public_key_derivation, reconfirmed here as the CURRENT state -- still no PUBLIC(crate) byte getter", () => {
    const structMatch = libRsSource.match(
      /impl FedosNostrSecretKeyHandle \{([\s\S]*?)\r?\n {4}\}\r?\n\r?\n {4}\/\/\/ Coarse observable outcome of a \[`derive_nostr_secret_key_internal`\]/,
    );
    const implBody = structMatch?.[1] ?? "";
    expect(implBody.length).toBeGreaterThan(0);
    expect(implBody).toMatch(/fn new_from_32_bytes_for_internal_use/);
    expect(implBody).toMatch(/pub\(crate\) fn kind\(&self\)/);
    expect(implBody).toMatch(/pub\(crate\) fn is_cleared\(&self\)/);
    expect(implBody).toMatch(/pub\(crate\) fn clear\(&mut self\)/);
    expect(implBody).toMatch(/pub\(crate\) fn matches_for_internal_verification\(&self, other: &Self\)/);
    // The Alpha 169 accessor is private (`fn`, never `pub(crate) fn`) -- confirm
    // no PUBLIC(crate)-visible byte getter exists, which is this test's own claim.
    expect(implBody).not.toMatch(/pub\(crate\) fn [a-zA-Z0-9_]+\([^)]*\) -> \[u8; 32\]/);
    expect(implBody).not.toMatch(/pub\(crate\) fn [a-zA-Z0-9_]+\([^)]*\) -> Option<\[u8; 32\]>/);
    expect(implBody).toMatch(
      /fn expose_bytes_for_internal_public_key_derivation\(&self\) -> Option<\[u8; 32\]> \{/,
    );
    expect(implBody).not.toMatch(/pub\(crate\) fn expose_bytes_for_internal_public_key_derivation/);
  });

  it("6. structural: FedosNostrSecretKeyHandle derives no Clone/Copy/Debug/PartialEq/Eq/Serialize", () => {
    expect(libRsSource).not.toMatch(
      /#\[derive\([^)]*\)\]\s*\n\s*pub\(crate\) struct FedosNostrSecretKeyHandle/,
    );
  });

  it("7. the design doc's own requirement-by-requirement review confirms every exposure prohibition", () => {
    const section = (designDocSource.match(/## 4\. Requirement-by-requirement review([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    for (const claim of [
      "**No raw byte getter, no export:**",
      "**`Clone` forbidden:**",
      "**No `Debug`-over-secret-value:**",
      "**No `Serialize`:**",
      "**No `wasm_bindgen`:**",
      "**Never reaches Desktop/TypeScript boundary:**",
    ]) {
      expect(section).toContain(claim);
    }
  });

  it("8. the design doc cross-references Alpha 162 and Alpha 151", () => {
    for (const ref of [
      "secure_runtime_alpha_162_nostr_account_derivation_decision",
      "secure_runtime_alpha_151_protocol_root_handle",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("9. Regression: the crate's #[wasm_bindgen] count remains fixed at 13", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
  });

  it("10. Regression: desktop_application.ts, fedos_runtime_identity.ts, and worker.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_163/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_163/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_163/);
  });

  it("11. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_163/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_163/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
