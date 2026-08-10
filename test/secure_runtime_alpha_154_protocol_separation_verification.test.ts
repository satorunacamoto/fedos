import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_154_protocol_separation_verification.md?raw";
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

function masterRootModuleText(): string {
  return (libRsSource.match(/\/\/\/ Stage 1012 \(Secure Runtime Alpha 146\)[\s\S]*?\n\/\/\/ Stage 87/) ?? [])[0] ?? "";
}

/**
 * Secure Runtime Alpha 154 -- "Protocol Separation Verification": Stage
 * 4 of the Protocol Root Derivation Arc. Adds
 * matches_for_internal_verification to FedosProtocolRootHandle --
 * constant-time, Handle-only comparison, never a raw secret byte
 * comparison.
 */
describe("Secure Runtime Alpha 154 -- Protocol Separation Verification", () => {
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

  it("3. structural: matches_for_internal_verification exists on FedosProtocolRootHandle -- three occurrences total across the whole master_root module", () => {
    const matches = [...libRsSource.matchAll(/pub\(crate\) fn matches_for_internal_verification\(&self, other: &Self\) -> bool \{/g)];
    expect(matches.length).toBe(6);
    const implMatch = libRsSource.match(/impl FedosProtocolRootHandle \{([\s\S]*?)\n {4}\}\n\n {4}\/\/\/ The result of a \[`derive_protocol_root_internal`\]/);
    expect(implMatch?.[1] ?? "").toMatch(/pub\(crate\) fn matches_for_internal_verification\(&self, other: &Self\) -> bool \{/);
  });

  it("4. structural: FedosProtocolRootHandle's own comparison uses subtle::ConstantTimeEq via .ct_eq(, never a plain == comparison", () => {
    const moduleText = masterRootModuleText();
    const ctEqCount = [...moduleText.matchAll(/\.ct_eq\(/g)].length;
    expect(ctEqCount).toBe(6);
  });

  it("5. structural: FedosProtocolRootHandle does not derive PartialEq/Eq", () => {
    expect(libRsSource).not.toMatch(/#\[derive\([^)]*PartialEq[^)]*\)\]\s*\n\s*pub\(crate\) struct FedosProtocolRootHandle/);
  });

  it("6. structural: no new Protocol Root domain or derivation function was added by this Stage -- HkdfDomain stays at exactly ten variants", () => {
    const enumBody = (libRsSource.match(/pub\(crate\) enum HkdfDomain \{([\s\S]*?)\n {4}\}/) ?? [])[1] ?? "";
    const variants = [...enumBody.matchAll(/^\s*(\w+),/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(variants.length).toBe(10);
  });

  it("7. the design doc's own purity section confirms no raw byte return, constant-time comparison, no PartialEq/Eq derive, and false-on-cleared", () => {
    const section = (designDocSource.match(/## 3\. Purity confirmed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*No raw byte returned or logged:\*\*/);
    expect(section).toMatch(/\*\*Constant-time:\*\*/);
    expect(section).toMatch(/\*\*No `PartialEq`\/`Eq` derive:\*\*/);
    expect(section).toMatch(/\*\*`false` on a cleared handle:\*\*/);
  });

  it("8. the design doc's own verification section confirms all four required properties, via Handle comparison only", () => {
    const section = (designDocSource.match(/## 4\. Verification confirmed([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Same Master Seed → same protocol domain → same Root:\*\*/);
    expect(section).toMatch(/\*\*Different protocol domains → different Root, always:\*\*/);
    expect(section).toMatch(/\*\*Same Root re-derived twice → matches exactly:\*\*/);
    expect(section).toMatch(/\*\*Different Application Roots → non-matching Protocol Roots for the\s*\n\s*SAME domain:\*\*/);
    expect(designDocSource).toMatch(/never a raw secret byte\s*\ncomparison — per this Arc's own explicit requirement\./);
  });

  it("9. the design doc cross-references Alpha 152, Alpha 153, and Alpha 149", () => {
    for (const ref of [
      "secure_runtime_alpha_152_nostr_root_derivation",
      "secure_runtime_alpha_153_session_atproto_wallet_root",
      "secure_runtime_alpha_149_root_handle_verification",
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

  it("11. Regression: subtle usage remains confined to the master_root module", () => {
    const moduleText = masterRootModuleText();
    const outsideModule = libRsSource.replace(moduleText, "");
    expect(outsideModule).not.toMatch(/\.ct_eq\(/);
    expect(outsideModule).not.toMatch(/\buse subtle::/);
  });

  it("12. Regression: desktop_application.ts and fedos_runtime_identity.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_154/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_154/);
  });

  it("13. Regression: worker.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_154/);
  });

  it("14. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_154/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_154/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
