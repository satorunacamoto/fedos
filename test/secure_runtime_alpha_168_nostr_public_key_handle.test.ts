import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_168_nostr_public_key_handle.md?raw";
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
 * Secure Runtime Alpha 168 -- "Nostr Public Key Handle": Stage 3 of the
 * Deterministic Nostr Public Key Derivation Arc. Adds the opaque
 * FedosNostrPublicKeyHandle type, holding a plain [u8; 32] x-only public
 * key -- NOT SecretHandle-backed, since public keys are not secret.
 */
describe("Secure Runtime Alpha 168 -- Nostr Public Key Handle", () => {
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

  it("3. structural: FedosNostrPublicKeyHandle exists, holds a plain [u8; 32] field (NOT a SecretHandle), and is pub(crate) only", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) struct FedosNostrPublicKeyHandle \{\s*\n\s*x_only_bytes: \[u8; 32\],\s*\n\s*\}/,
    );
    expect(libRsSource).not.toMatch(/^pub struct FedosNostrPublicKeyHandle/m);
  });

  it("4. structural: FedosNostrPublicKeyHandle exposes only matches_for_internal_verification (plus its private constructor) -- no kind/is_cleared/clear, no raw byte getter", () => {
    const implMatch = libRsSource.match(
      /impl FedosNostrPublicKeyHandle \{([\s\S]*?)\r?\n {4}\}\r?\n\r?\n {4}\/\/\/ Derive a NEW \[`FedosNostrPublicKeyHandle`\]/,
    );
    const implBody = implMatch?.[1] ?? "";
    expect(implBody.length).toBeGreaterThan(0);
    expect(implBody).toMatch(/fn new_from_32_bytes_for_internal_use/);
    expect(implBody).toMatch(/pub\(crate\) fn matches_for_internal_verification\(&self, other: &Self\)/);
    expect(implBody).not.toMatch(/pub\(crate\) fn kind\(/);
    expect(implBody).not.toMatch(/pub\(crate\) fn is_cleared\(/);
    expect(implBody).not.toMatch(/pub\(crate\) fn clear\(/);
    expect(implBody).not.toMatch(/-> \[u8; 32\]/);
    expect(implBody).not.toMatch(/-> Option<\[u8; 32\]>/);
  });

  it("5. structural: FedosNostrPublicKeyHandle derives no Clone/Copy/Debug/PartialEq/Eq/Serialize", () => {
    expect(libRsSource).not.toMatch(
      /#\[derive\([^)]*\)\]\s*\n\s*pub\(crate\) struct FedosNostrPublicKeyHandle/,
    );
  });

  it("6. structural: comparison uses subtle::ConstantTimeEq (ct_eq), never a plain ==", () => {
    const methodMatch = libRsSource.match(
      /pub\(crate\) fn matches_for_internal_verification\(&self, other: &Self\) -> bool \{\s*\n\s*bool::from\(self\.x_only_bytes\.ct_eq\(&other\.x_only_bytes\)\)\s*\n\s*\}/,
    );
    expect(methodMatch).not.toBeNull();
  });

  it("7. the design doc's own requirement-by-requirement review confirms every exposure prohibition and the Clone investigation", () => {
    const section = (designDocSource.match(/## 3\. Requirement-by-requirement review([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const claim of [
      "**No raw secret reference:**",
      "**No raw byte getter added this Stage:**",
      "**No `Serialize`:**",
      "**No `wasm_bindgen`:**",
      "**Never reaches Desktop/TypeScript boundary:**",
      "**No `Debug` implementation added:**",
      "**`Clone` investigated, not added:**",
    ]) {
      expect(section).toContain(claim);
    }
  });

  it("8. the design doc explains why NOT a SecretHandle-backed type", () => {
    const section = (designDocSource.match(/## 4\. Why NOT a `SecretHandle`-backed type([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section.length).toBeGreaterThan(0);
    expect(section).toMatch(/is, by definition, not secret material/);
  });

  it("9. the design doc cross-references Alpha 167 and Alpha 163", () => {
    for (const ref of [
      "secure_runtime_alpha_167_nostr_public_key_representation_decision",
      "secure_runtime_alpha_163_nostr_secret_key_handle",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("10. Regression: the crate's #[wasm_bindgen] count remains fixed at 13", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(13);
  });

  it("11. Regression: desktop_application.ts, fedos_runtime_identity.ts, and worker.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_168/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_168/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_168/);
  });

  it("12. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_168/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_168/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
