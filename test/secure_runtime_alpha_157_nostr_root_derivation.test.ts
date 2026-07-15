import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_157_nostr_root_derivation.md?raw";
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
 * Secure Runtime Alpha 157 -- "Nostr Root Derivation": Stage 2 of the
 * Nostr Root Foundation Arc. A REVIEW ONLY Stage -- zero code change.
 * Confirms the existing derive_nostr_root_internal (Alpha 152)
 * already satisfies this Arc's own HKDF-only requirement.
 */
describe("Secure Runtime Alpha 157 -- Nostr Root Derivation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(
      /It makes NO code change of any\s*\nkind — no `packages\/` file, no `src\/` file, is modified\./,
    );
  });

  it("3. the design doc's own requirement-by-requirement review section confirms all three Arc requirements", () => {
    const section = (designDocSource.match(/## 3\. Requirement-by-requirement review([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*"using ONLY the existing HKDF infrastructure":\*\* confirmed\./);
    expect(section).toMatch(/\*\*"No new crypto":\*\* confirmed\./);
    expect(section).toMatch(
      /\*\*"No new labels outside the protocol-domain already established":\*\*\n\s*confirmed\./,
    );
  });

  it("4. the design doc cross-references Alpha 156, Alpha 152, and Alpha 147", () => {
    for (const ref of [
      "secure_runtime_alpha_156_nostr_root_handle",
      "secure_runtime_alpha_152_nostr_root_derivation",
      "secure_runtime_alpha_147_identity_root_derivation",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the existing derivation really does satisfy
  // every claim, directly against lib.rs
  // ---------------------------------------------------------------------

  it("5. structural: derive_nostr_root_internal delegates to derive_protocol_root_internal under HkdfDomain::Nostr only", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) fn derive_nostr_root_internal\(\s*\n\s*application_root: &FedosApplicationRootHandle,\s*\n\s*\) -> ProtocolRootDecision \{\s*\n\s*derive_protocol_root_internal\(application_root, HkdfDomain::Nostr\)\s*\n\s*\}/,
    );
  });

  it("6. structural: derive_protocol_root_internal calls the crate's ONE production HKDF call site, kdf_core::derive_secret_handle_internal's caller derive_secret_handle_internal", () => {
    const fnMatch = libRsSource.match(/fn derive_protocol_root_internal\(([\s\S]*?)\n {4}\}/);
    const fnBody = fnMatch?.[1] ?? "";
    expect(fnBody.length).toBeGreaterThan(0);
    expect(fnBody).toMatch(/derive_secret_handle_internal\(&transient_input, domain\)/);
    expect(fnBody).toMatch(/transient_input\.clear\(\);/);
  });

  it("7. structural: HkdfDomain::Nostr's fixed salt/info are unchanged from Alpha 152", () => {
    expect(libRsSource).toMatch(/HkdfDomain::Nostr => b"fedos-hkdf-salt-nostr-v1"/);
    expect(libRsSource).toMatch(/HkdfDomain::Nostr => b"fedos-hkdf-info-nostr-v1"/);
  });

  it("8. structural: HkdfDomain still has exactly its ten Alpha 151-155 variants -- no new domain added by this Stage", () => {
    const enumBody = (libRsSource.match(/pub\(crate\) enum HkdfDomain \{([\s\S]*?)\n {4}\}/) ?? [])[1] ?? "";
    const variants = [...enumBody.matchAll(/^\s*(\w+),/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(variants).toEqual([
      "RootKey",
      "Identity",
      "Storage",
      "Conversation",
      "Application",
      "Nostr",
      "Session",
      "ATProto",
      "Wallet",
      "TestOnly",
    ]);
  });

  it("9. structural: derive_protocol_root_internal is never pub(crate) -- only its fixed-domain wrappers are", () => {
    expect(libRsSource).not.toMatch(/pub\(crate\) fn derive_protocol_root_internal/);
    expect(libRsSource).toMatch(/\n {4}fn derive_protocol_root_internal\(/);
  });

  it("10. structural: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(15);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(44);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("11. Regression: lib.rs carries no reference to this Stage's own doc -- confirming zero Rust change", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_157/);
  });

  it("12. Regression: desktop_application.ts and fedos_runtime_identity.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_157/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_157/);
  });

  it("13. Regression: worker.ts carries no reference to this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_157/);
  });

  it("14. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_157/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_157/);
  });
});
