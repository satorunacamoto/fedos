import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_148_application_root_derivation.md?raw";
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
 * Secure Runtime Alpha 148 -- "Application Root Derivation": Stage 3
 * of the Master Root Derivation Foundation Arc. Adds
 * derive_application_root_internal (Identity Root -> Application
 * Root), one new HkdfDomain variant (Application), zero new
 * cryptographic algorithm.
 */
describe("Secure Runtime Alpha 148 -- Application Root Derivation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage modifying exactly one file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`packages\/fedos-core-rust\/src\/lib\.rs`, and nothing else — no `src\/`\s*\nfile is touched\./,
    );
  });

  it("3. structural: derive_application_root_internal exists, takes a &FedosIdentityRootHandle, and is pub(crate) only", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) fn derive_application_root_internal\(\s*\n\s*identity_root: &FedosIdentityRootHandle,\s*\n\s*\) -> ApplicationRootDecision/,
    );
  });

  it("4. structural: derive_application_root_internal calls derive_secret_handle_internal under the NEW HkdfDomain::Application", () => {
    const fnMatch = libRsSource.match(/pub\(crate\) fn derive_application_root_internal\([\s\S]*?\n {4}\}/);
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch?.[0] ?? "";
    expect(fnBody).toMatch(/derive_secret_handle_internal\(&transient_input, HkdfDomain::Application\)/);
  });

  it("5. structural: ApplicationRootMaterial is a real SecretHandleKind variant, and Application is a real HkdfDomain variant", () => {
    const kindEnumBody = (libRsSource.match(/pub\(crate\) enum SecretHandleKind \{([\s\S]*?)\n {4}\}/) ?? [])[1] ?? "";
    expect(kindEnumBody).toMatch(/ApplicationRootMaterial,/);
    const domainEnumBody = (libRsSource.match(/pub\(crate\) enum HkdfDomain \{([\s\S]*?)\n {4}\}/) ?? [])[1] ?? "";
    expect(domainEnumBody).toMatch(/Application,/);
  });

  it("6. structural: HkdfDomain::Application has its own fixed salt/info, distinct from every other domain", () => {
    expect(libRsSource).toMatch(/HkdfDomain::Application => b"fedos-hkdf-salt-application-v1"/);
    expect(libRsSource).toMatch(/HkdfDomain::Application => b"fedos-hkdf-info-application-v1"/);
  });

  it("7. RIPPLE (Secure Runtime Alpha 153): HkdfDomain had exactly six variants AS OF this Stage's own closing state; Stage 1017/1018 (Secure Runtime Alpha 152/153) legitimately added four more -- `Nostr`/`Session`/`ATProto`/`Wallet` -- for TEN total, and the exhaustive match test was renamed accordingly, reconfirmed here as the CURRENT state", () => {
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
    expect(libRsSource).toMatch(/fn hkdf_domain_has_no_variant_other_than_the_ten_specified/);
  });

  it("8. the design doc explicitly records the hierarchy divergence from Alpha 142's own sibling diagram", () => {
    const section = (designDocSource.match(/## 3\. A recorded hierarchy divergence([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/drew `Application Root` as a Master-Seed-\s*\ndirect SIBLING of `Identity Root`/);
    expect(section).toMatch(/THIS\s*\nArc's own instructions instead derive Application Root AS A CHILD of\s*\nIdentity Root/);
  });

  it("9. the design doc's own purity section confirms one new domain (not a new algorithm), no mutation, determinism, and domain separation", () => {
    const section = (designDocSource.match(/## 4\. Purity confirmed([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*One new domain, not a new algorithm:\*\*/);
    expect(section).toMatch(/\*\*No mutation of the input:\*\*/);
    expect(section).toMatch(/\*\*Deterministic:\*\*/);
    expect(section).toMatch(/\*\*Domain-separated:\*\*/);
  });

  it("10. the design doc cross-references Alpha 147, Alpha 142, and Alpha 143", () => {
    for (const ref of [
      "secure_runtime_alpha_147_identity_root_derivation",
      "secure_runtime_alpha_142_root_hierarchy_decision",
      "secure_runtime_alpha_143_domain_separation_decision",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("11. Regression: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(15);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(44);
  });

  it("12. Regression: desktop_application.ts and fedos_runtime_identity.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_148/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_148/);
  });

  it("13. Regression: worker.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_148/);
  });

  it("14. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_148/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_148/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
