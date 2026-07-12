import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_158_nostr_root_verification.md?raw";
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
 * Secure Runtime Alpha 158 -- "Nostr Root Verification": Stage 3 of
 * the Nostr Root Foundation Arc. A REVIEW ONLY Stage -- zero code
 * change. Confirms the existing matches_for_internal_verification
 * (Alpha 154) already covers Nostr Root instances, constant-time,
 * Handle-only.
 */
describe("Secure Runtime Alpha 158 -- Nostr Root Verification", () => {
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

  it("3. the design doc's own requirement-by-requirement review confirms both Arc requirements", () => {
    const section = (designDocSource.match(/## 3\. Requirement-by-requirement review([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*"Use constant-time comparison only":\*\* confirmed\./);
    expect(section).toMatch(
      /\*\*"Never compare raw byte arrays outside Handle types":\*\* confirmed\./,
    );
  });

  it("4. the design doc cites the exact Alpha 154 test names that already exercise Nostr-specific separation", () => {
    expect(designDocSource).toContain("different_protocol_domains_from_the_same_application_root_never_match");
    expect(designDocSource).toContain("same_protocol_root_rederived_twice_matches_exactly_via_handle_comparison");
  });

  it("5. the design doc cross-references Alpha 157, Alpha 154, and Alpha 149", () => {
    for (const ref of [
      "secure_runtime_alpha_157_nostr_root_derivation",
      "secure_runtime_alpha_154_protocol_separation_verification",
      "secure_runtime_alpha_149_root_handle_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the cited Rust code really exists as claimed
  // ---------------------------------------------------------------------

  it("6. structural: matches_for_internal_verification uses subtle::ConstantTimeEq (ct_eq), never a plain ==", () => {
    const implMatch = libRsSource.match(/impl FedosProtocolRootHandle \{([\s\S]*?)\n {4}\}\n\n {4}\/\/\/ The result of a \[`derive_protocol_root_internal`\]/);
    const implBody = implMatch?.[1] ?? "";
    const methodMatch = implBody.match(/pub\(crate\) fn matches_for_internal_verification\(&self, other: &Self\) -> bool \{([\s\S]*?)\n {8}\}/);
    const methodBody = methodMatch?.[1] ?? "";
    expect(methodBody.length).toBeGreaterThan(0);
    expect(methodBody).toMatch(/left\.ct_eq\(&right\)/);
    expect(methodBody).toMatch(/left\.zeroize\(\);/);
    expect(methodBody).toMatch(/right\.zeroize\(\);/);
  });

  it("7. structural: FedosProtocolRootHandle derives no PartialEq/Eq -- matches_for_internal_verification is the only comparison", () => {
    expect(libRsSource).not.toMatch(/#\[derive\([^)]*(?:PartialEq|Eq)[^)]*\)\]\s*\n\s*pub\(crate\) struct FedosProtocolRootHandle/);
  });

  it("8. structural: ALL_PROTOCOL_ROOT_DERIVE_FNS includes derive_nostr_root_internal, and the pairwise-non-match test iterates it", () => {
    const arrMatch = libRsSource.match(/const ALL_PROTOCOL_ROOT_DERIVE_FNS: \[ProtocolRootDeriveFn; 4\] = \[([\s\S]*?)\];/);
    const arrBody = arrMatch?.[1] ?? "";
    expect(arrBody).toMatch(/derive_nostr_root_internal/);
    expect(libRsSource).toMatch(/fn different_protocol_domains_from_the_same_application_root_never_match\(\) \{/);
    expect(libRsSource).toMatch(/fn same_protocol_root_rederived_twice_matches_exactly_via_handle_comparison\(\) \{/);
  });

  it("9. structural: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(13);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(36);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("10. Regression: lib.rs carries no reference to this Stage's own doc -- confirming zero Rust change", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_158/);
  });

  it("11. Regression: desktop_application.ts and fedos_runtime_identity.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_158/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_158/);
  });

  it("12. Regression: worker.ts carries no reference to this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_158/);
  });

  it("13. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_158/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_158/);
  });
});
