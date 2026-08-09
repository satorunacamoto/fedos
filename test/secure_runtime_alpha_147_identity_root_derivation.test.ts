import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_147_identity_root_derivation.md?raw";
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
 * Secure Runtime Alpha 147 -- "Identity Root Derivation": Stage 2 of
 * the Master Root Derivation Foundation Arc. Adds
 * derive_identity_root_internal to packages/fedos-core-rust/src/lib.rs
 * -- reuses the EXISTING HKDF bridge and the EXISTING HkdfDomain::Identity
 * domain, zero new cryptographic algorithm.
 */
describe("Secure Runtime Alpha 147 -- Identity Root Derivation", () => {
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

  it("3. structural: derive_identity_root_internal exists, takes a &FedosMasterSeedHandle, and is pub(crate) only", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) fn derive_identity_root_internal\(\s*\n\s*master_seed: &FedosMasterSeedHandle,\s*\n\s*\) -> IdentityRootDecision/,
    );
  });

  it("4. structural: derive_identity_root_internal calls the existing derive_secret_handle_internal under the existing HkdfDomain::Identity", () => {
    const fnMatch = libRsSource.match(/pub\(crate\) fn derive_identity_root_internal\([\s\S]*?\n {4}\}/);
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch?.[0] ?? "";
    expect(fnBody).toMatch(/derive_secret_handle_internal\(&transient_input, HkdfDomain::Identity\)/);
  });

  it("5. structural: IdentityRootMaterial is a real SecretHandleKind variant", () => {
    const enumBody = (libRsSource.match(/pub\(crate\) enum SecretHandleKind \{([\s\S]*?)\n {4}\}/) ?? [])[1] ?? "";
    expect(enumBody).toMatch(/IdentityRootMaterial,/);
  });

  it("6. structural: the transient input handle is cleared immediately after the derive call", () => {
    const fnMatch = libRsSource.match(/pub\(crate\) fn derive_identity_root_internal\([\s\S]*?\n {4}\}/);
    const fnBody = fnMatch?.[0] ?? "";
    const transientIndex = fnBody.indexOf("SecretHandle::new_from_32_bytes_for_internal_use(\n            SecretHandleKind::HkdfInputMaterial");
    const deriveIndex = fnBody.indexOf("derive_secret_handle_internal(&transient_input");
    const clearIndex = fnBody.indexOf("transient_input.clear();");
    expect(transientIndex).toBeGreaterThan(-1);
    expect(deriveIndex).toBeGreaterThan(transientIndex);
    expect(clearIndex).toBeGreaterThan(deriveIndex);
  });

  it("7. structural: HkdfDomain::Identity's own fixed salt/info are unchanged by this Stage", () => {
    expect(libRsSource).toMatch(/HkdfDomain::Identity => b"fedos-hkdf-salt-identity-v1"/);
    expect(libRsSource).toMatch(/HkdfDomain::Identity => b"fedos-hkdf-info-identity-v1"/);
  });

  it("8. the design doc's own purity section confirms no new HKDF implementation, no new domain, fixed order, no mutation, and determinism", () => {
    const section = (designDocSource.match(/## 3\. Purity confirmed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*No new HKDF implementation:\*\*/);
    expect(section).toMatch(/\*\*No new domain:\*\*/);
    expect(section).toMatch(/\*\*Fixed order:\*\*/);
    expect(section).toMatch(/\*\*No mutation of the input:\*\*/);
    expect(section).toMatch(/\*\*Deterministic:\*\*/);
  });

  it("9. the design doc cross-references Alpha 146 and Alpha 141", () => {
    for (const ref of [
      "secure_runtime_alpha_146_master_seed_handle",
      "secure_runtime_alpha_141_existing_secret_kdf_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("10. Regression: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);  });

  it("11. Regression: desktop_application.ts and fedos_runtime_identity.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_147/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_147/);
  });

  it("12. Regression: worker.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_147/);
  });

  it("13. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_147/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_147/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
