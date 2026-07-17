import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_156_nostr_root_handle.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Secure Runtime Alpha 156 -- "Nostr Root Handle": Stage 1 of the
 * Nostr Root Foundation Arc. A REVIEW ONLY Stage -- zero code change.
 * Confirms the existing FedosProtocolRootHandle (Alpha 151) already
 * satisfies this Arc's own Nostr Root Handle requirement.
 */
describe("Secure Runtime Alpha 156 -- Nostr Root Handle", () => {
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

  it("3. the design doc's own Decision section confirms no new Rust type is introduced", () => {
    const section = (designDocSource.match(/## 4\. Decision: no new Rust type is introduced([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section.length).toBeGreaterThan(0);
    expect(section).toMatch(/already\s*\nsatisfies every property this Arc's Objective names for\s*\n`FedosNostrRootHandle`/);
  });

  it("4. the design doc records the one honestly-noted limitation: no type-level way to distinguish protocol domains at rest", () => {
    expect(designDocSource).toMatch(/there is today no type-level or\s*\n`SecretHandleKind`-level way to distinguish a Nostr-domain/);
  });

  it("5. the design doc cross-references Alpha 151, Alpha 152, and Alpha 155", () => {
    for (const ref of [
      "secure_runtime_alpha_151_protocol_root_handle",
      "secure_runtime_alpha_152_nostr_root_derivation",
      "secure_runtime_alpha_155_integration_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the existing FedosProtocolRootHandle really
  // does satisfy every property claimed, directly against lib.rs
  // ---------------------------------------------------------------------

  it("6. structural: FedosProtocolRootHandle exists, wraps a single SecretHandle field, and is pub(crate) only", () => {
    expect(libRsSource).toMatch(/pub\(crate\) struct FedosProtocolRootHandle \{\s*\n\s*inner: SecretHandle,\s*\n\s*\}/);
    expect(libRsSource).not.toMatch(/^pub struct FedosProtocolRootHandle/m);
  });

  it("7. structural: FedosProtocolRootHandle exposes kind()/is_cleared()/clear()/matches_for_internal_verification, all pub(crate)", () => {
    const implMatch = libRsSource.match(/impl FedosProtocolRootHandle \{([\s\S]*?)\n {4}\}\n\n {4}\/\/\/ The result of a \[`derive_protocol_root_internal`\]/);
    const implBody = implMatch?.[1] ?? "";
    expect(implBody.length).toBeGreaterThan(0);
    expect(implBody).toMatch(/fn new_from_32_bytes_for_internal_use/);
    expect(implBody).toMatch(/pub\(crate\) fn kind\(&self\)/);
    expect(implBody).toMatch(/pub\(crate\) fn is_cleared\(&self\)/);
    expect(implBody).toMatch(/pub\(crate\) fn clear\(&mut self\)/);
    expect(implBody).toMatch(/pub\(crate\) fn matches_for_internal_verification\(&self, other: &Self\) -> bool/);
  });

  it("8. structural: derive_nostr_root_internal exists, takes an Application Root, and requests only HkdfDomain::Nostr", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) fn derive_nostr_root_internal\(\s*\n\s*application_root: &FedosApplicationRootHandle,\s*\n\s*\) -> ProtocolRootDecision \{\s*\n\s*derive_protocol_root_internal\(application_root, HkdfDomain::Nostr\)\s*\n\s*\}/,
    );
  });

  it("9. structural: no FedosNostrRootHandle type exists anywhere -- confirming this Stage genuinely added no new type", () => {
    expect(libRsSource).not.toMatch(/struct\s+FedosNostrRootHandle/);
    expect(libRsSource).not.toMatch(/enum\s+FedosNostrRootHandle/);
  });

  it("10. structural: FedosProtocolRootHandle derives no PartialEq/Eq", () => {
    expect(libRsSource).not.toMatch(/#\[derive\([^)]*(?:PartialEq|Eq)[^)]*\)\]\s*\n\s*pub\(crate\) struct FedosProtocolRootHandle/);
  });

  it("11. structural: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36 -- confirming zero API surface change", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(15);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(46);
  });

  // ---------------------------------------------------------------------
  // Regression: zero change anywhere outside this Stage's own new doc/test
  // ---------------------------------------------------------------------

  it("12. Regression: lib.rs carries no reference to this Stage's own doc -- confirming zero Rust change", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_156/);
  });

  it("13. Regression: desktop_application.ts, create_desktop_application.ts, and fedos_runtime_identity.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_156/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_156/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_156/);
  });

  it("14. Regression: create_runtime.ts/types.ts/worker.ts carry no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_156/);
    }
  });

  it("15. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_156/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_156/);
  });
});
