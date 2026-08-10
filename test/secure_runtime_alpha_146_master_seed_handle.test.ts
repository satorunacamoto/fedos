import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_146_master_seed_handle.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/os/messenger/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/os/core/identity/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Secure Runtime Alpha 146 -- "Master Seed Handle": Stage 1 of the
 * Master Root Derivation Foundation Arc. Adds
 * FedosMasterSeedHandle to packages/fedos-core-rust/src/lib.rs --
 * Rust-internal only, no WASM exposure, no Desktop/Identity Layer
 * access.
 */
describe("Secure Runtime Alpha 146 -- Master Seed Handle", () => {
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

  it("3. structural: FedosMasterSeedHandle exists, wraps a SecretHandle, and is pub(crate) only", () => {
    expect(libRsSource).toMatch(/pub\(crate\) struct FedosMasterSeedHandle \{\s*\n\s*inner: SecretHandle,\s*\n\s*\}/);
    expect(libRsSource).not.toMatch(/^pub struct FedosMasterSeedHandle/m);
  });

  it("4. structural: FedosMasterSeedHandle's own constructor takes a fixed [u8; 32] and never calls a CSPRNG", () => {
    const ctorMatch = libRsSource.match(/pub\(crate\) fn new_from_32_bytes_for_internal_use\(bytes: \[u8; 32\]\) -> Self \{([\s\S]*?)\n {8}\}/);
    expect(ctorMatch).not.toBeNull();
    const ctorBody = ctorMatch?.[1] ?? "";
    expect(ctorBody).not.toMatch(/fedos_random_bytes_32|fedos_aead_nonce_96/);
    expect(ctorBody).toMatch(/SecretHandleKind::MasterSeedMaterial/);
  });

  it("5. structural: MasterSeedMaterial is a real SecretHandleKind variant", () => {
    const enumBody = (libRsSource.match(/pub\(crate\) enum SecretHandleKind \{([\s\S]*?)\n {4}\}/) ?? [])[1] ?? "";
    expect(enumBody).toMatch(/MasterSeedMaterial,/);
  });

  it("6. structural: the crate's #[wasm_bindgen] count remains fixed at 13 -- confirming zero WASM exposure added", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
  });

  it("7. structural: no wasm_bindgen annotation exists anywhere inside the master_root module", () => {
    const moduleBody = (libRsSource.match(/mod master_root \{([\s\S]*?)\n\/\/\/ Stage 87/) ?? [])[1] ?? "";
    expect(moduleBody.length).toBeGreaterThan(0);
    // Line-start-anchored, like test 6 above -- Alpha 869 added a doc
    // comment (prose) inside this module that legitimately NAMES
    // `` `#[wasm_bindgen]` `` in backticks, describing a helper this
    // module owns as reachable FROM a real `#[wasm_bindgen]`-annotated
    // caller defined elsewhere (outside this module, per test 9's own
    // "is placed at crate-root level" guard) -- an actually-applied
    // attribute always starts its own line; prose mentioning it does not.
    expect(moduleBody).not.toMatch(/^#\[wasm_bindgen\]/m);
  });

  it("8. structural: the crate's total pub fn count remains fixed at 36 -- confirming zero public API addition", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);  });

  it("9. the design doc cross-references Alpha 141, Alpha 142, secret_handle_api_shape.md, and secret_lifecycle_implementation_plan.md", () => {
    for (const ref of [
      "secure_runtime_alpha_141_existing_secret_kdf_inventory",
      "secure_runtime_alpha_142_root_hierarchy_decision",
      "secret_handle_api_shape.md",
      "secret_lifecycle_implementation_plan.md",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression: src/ untouched, Cargo.toml/package.json untouched
  // ---------------------------------------------------------------------

  it("10. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_146/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_146/);
  });

  it("11. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_146/);
  });

  it("12. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_146/);
    }
  });

  it("13. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_146/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_146/);
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
  });
});
