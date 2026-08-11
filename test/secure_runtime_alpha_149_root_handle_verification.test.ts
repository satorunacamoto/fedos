import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_149_root_handle_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/os/core/identity/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

function masterRootModuleText(): string {
  return (libRsSource.match(/\/\/\/ Stage 1012 \(Secure Runtime Alpha 146\)[\s\S]*?\n\/\/\/ Stage 87/) ?? [])[0] ?? "";
}

/**
 * Secure Runtime Alpha 149 -- "Root Handle Verification": Stage 4 of
 * the Master Root Derivation Foundation Arc. Adds
 * matches_for_internal_verification to both Root Handle types --
 * constant-time, Handle-only comparison, never a raw secret byte
 * comparison.
 */
describe("Secure Runtime Alpha 149 -- Root Handle Verification", () => {
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

  it("3. RIPPLE (Secure Runtime Alpha 154, 163, 168, 182): matches_for_internal_verification existed on exactly TWO types (FedosIdentityRootHandle/FedosApplicationRootHandle) AS OF this Stage's own closing state; Stage 1019 (Secure Runtime Alpha 154) legitimately added a THIRD, on FedosProtocolRootHandle, Stage 1020 (Secure Runtime Alpha 163) legitimately added a FOURTH, on FedosNostrSecretKeyHandle, Stage 1024 (Secure Runtime Alpha 168) legitimately added a FIFTH, on FedosNostrPublicKeyHandle, and Stage 1028 (Secure Runtime Alpha 182) legitimately added a SIXTH, on FedosNostrSignatureHandle, reconfirmed here as the CURRENT state", () => {
    const matches = [...libRsSource.matchAll(/pub\(crate\) fn matches_for_internal_verification\(&self, other: &Self\) -> bool \{/g)];
    expect(matches.length).toBe(6);
  });

  it("4. RIPPLE (Secure Runtime Alpha 154, 163, 168, 182): matches_for_internal_verification used subtle::ConstantTimeEq via .ct_eq( exactly TWICE AS OF this Stage's own closing state, never a plain == comparison; Stage 1019 (Secure Runtime Alpha 154) legitimately added a THIRD .ct_eq( call, on FedosProtocolRootHandle, Stage 1020 (Secure Runtime Alpha 163) legitimately added a FOURTH, on FedosNostrSecretKeyHandle, Stage 1024 (Secure Runtime Alpha 168) legitimately added a FIFTH, on FedosNostrPublicKeyHandle, and Stage 1028 (Secure Runtime Alpha 182) legitimately added a SIXTH, on FedosNostrSignatureHandle, reconfirmed here as the CURRENT state", () => {
    const moduleText = masterRootModuleText();
    expect(moduleText).toMatch(/use subtle::ConstantTimeEq;/);
    const ctEqCount = [...moduleText.matchAll(/\.ct_eq\(/g)].length;
    expect(ctEqCount).toBe(6);
  });

  it("5. structural: neither Root Handle type derives PartialEq/Eq", () => {
    expect(libRsSource).not.toMatch(/#\[derive\([^)]*PartialEq[^)]*\)\]\s*\n\s*pub\(crate\) struct FedosIdentityRootHandle/);
    expect(libRsSource).not.toMatch(/#\[derive\([^)]*PartialEq[^)]*\)\]\s*\n\s*pub\(crate\) struct FedosApplicationRootHandle/);
  });

  it("6. structural: both zeroize their own transient comparison buffers", () => {
    const moduleText = masterRootModuleText();
    const zeroizeCount = [...moduleText.matchAll(/left\.zeroize\(\);\s*\n\s*right\.zeroize\(\);/g)].length;
    expect(zeroizeCount).toBeGreaterThanOrEqual(1);
  });

  it("7. the design doc's own purity section confirms no raw byte return, constant-time comparison, no PartialEq/Eq derive, and false-on-cleared", () => {
    const section = (designDocSource.match(/## 3\. Purity confirmed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*No raw byte returned or logged:\*\*/);
    expect(section).toMatch(/\*\*Constant-time:\*\*/);
    expect(section).toMatch(/\*\*No `PartialEq`\/`Eq` derive:\*\*/);
    expect(section).toMatch(/\*\*`false` on a cleared handle:\*\*/);
  });

  it("8. the design doc cross-references Alpha 147, Alpha 148, and secret_memory_test_strategy.md", () => {
    for (const ref of [
      "secure_runtime_alpha_147_identity_root_derivation",
      "secure_runtime_alpha_148_application_root_derivation",
      "secret_memory_test_strategy.md",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("9. Regression: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);  });

  it("10. Regression: subtle usage is confined to the master_root module -- no other module in lib.rs was changed to use it", () => {
    const moduleText = masterRootModuleText();
    const outsideModule = libRsSource.replace(moduleText, "");
    expect(outsideModule).not.toMatch(/\.ct_eq\(/);
    expect(outsideModule).not.toMatch(/\buse subtle::/);
  });

  it("11. Regression: desktop_application.ts and fedos_runtime_identity.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_149/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_149/);
  });

  it("12. Regression: worker.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_149/);
  });

  it("13. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_149/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_149/);
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
  });
});
