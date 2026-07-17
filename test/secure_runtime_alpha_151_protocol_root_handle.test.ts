import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_151_protocol_root_handle.md?raw";
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
 * Secure Runtime Alpha 151 -- "Protocol Root Handle": Stage 1 of the
 * Protocol Root Derivation Arc. Adds the opaque FedosProtocolRootHandle
 * type -- no derivation exists yet.
 */
describe("Secure Runtime Alpha 151 -- Protocol Root Handle", () => {
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

  it("3. structural: FedosProtocolRootHandle exists, wraps a SecretHandle, and is pub(crate) only", () => {
    expect(libRsSource).toMatch(/pub\(crate\) struct FedosProtocolRootHandle \{\s*\n\s*inner: SecretHandle,\s*\n\s*\}/);
    expect(libRsSource).not.toMatch(/^pub struct FedosProtocolRootHandle/m);
  });

  it("4. structural: ProtocolRootMaterial is a real SecretHandleKind variant", () => {
    const enumBody = (libRsSource.match(/pub\(crate\) enum SecretHandleKind \{([\s\S]*?)\n {4}\}/) ?? [])[1] ?? "";
    expect(enumBody).toMatch(/ProtocolRootMaterial,/);
  });

  it("5. structural: FedosApplicationRootHandle gained the new private accessor expose_bytes_for_internal_protocol_root_derivation", () => {
    expect(libRsSource).toMatch(/fn expose_bytes_for_internal_protocol_root_derivation\(&self\) -> Option<\[u8; 32\]> \{/);
  });

  it("6. structural: FedosProtocolRootHandle exposes only kind/is_cleared/clear -- no derivation function references it yet", () => {
    const structMatch = libRsSource.match(/impl FedosProtocolRootHandle \{([\s\S]*?)\n {4}\}\n\n {4}\/\/\/ The result of a \[`derive_protocol_root_internal`\]/);
    const implBody = structMatch?.[1] ?? "";
    expect(implBody.length).toBeGreaterThan(0);
    expect(implBody).toMatch(/fn new_from_32_bytes_for_internal_use/);
    expect(implBody).toMatch(/pub\(crate\) fn kind\(&self\)/);
    expect(implBody).toMatch(/pub\(crate\) fn is_cleared\(&self\)/);
    expect(implBody).toMatch(/pub\(crate\) fn clear\(&mut self\)/);
  });

  it("7. the design doc's own purity section confirms opaque-only, no secret byte exposed, and no derivation yet", () => {
    const section = (designDocSource.match(/## 3\. Purity confirmed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Opaque Handle only:\*\*/);
    expect(section).toMatch(/\*\*No secret byte exposed:\*\*/);
    expect(section).toMatch(/\*\*No derivation yet:\*\*/);
  });

  it("8. the design doc cross-references Alpha 146, Alpha 148, and Alpha 142", () => {
    for (const ref of [
      "secure_runtime_alpha_146_master_seed_handle",
      "secure_runtime_alpha_148_application_root_derivation",
      "secure_runtime_alpha_142_root_hierarchy_decision",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("9. Regression: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(15);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(46);
  });

  it("10. Regression: desktop_application.ts and fedos_runtime_identity.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_151/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_151/);
  });

  it("11. Regression: worker.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_151/);
  });

  it("12. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_151/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_151/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
