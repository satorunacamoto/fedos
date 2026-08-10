import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_197_event_boundary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Secure Runtime Alpha 197 -- "Nostr Event Boundary Review": Stage 7
 * of the Nostr Event Foundation Arc (Alpha 191-200). REVIEW ONLY --
 * zero code change. Confirms FedosNostrEventHandle exposes no
 * internal mutable state: zero &mut self methods, zero interior
 * mutability.
 */
describe("Secure Runtime Alpha 197 -- Nostr Event Boundary Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(
      /It makes NO code change of any\s*\nkind — no `src\/` file, no `packages\/` file, is modified\./,
    );
  });

  it("3. the design doc explains why immutability matters for the ID/signature guarantees", () => {
    const section = (designDocSource.match(/## 2\. What "internal mutable state" would mean here[\s\S]*?\n## 3\./) ?? [])[0] ?? "";
    expect(section).toMatch(/silently breaking the "identical input →\s*\nidentical Event ID" guarantee/);
    expect(section).toMatch(/quietly invalidated by a later mutation/);
  });

  it("4. the design doc confirms exactly two methods, neither &mut self", () => {
    const section = (designDocSource.match(/## 3\. Confirmed: zero `&mut self` method exists([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toContain("new_for_internal_use");
    expect(section).toContain("expose_fields_for_internal_canonical_serialization");
    expect(section).toMatch(/Neither takes `&mut self`\./);
  });

  it("5. the design doc confirms no interior mutability primitive is used", () => {
    const section = (designDocSource.match(/## 4\. No interior mutability of any kind([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    for (const primitive of ["Cell", "RefCell", "Mutex", "RwLock"]) {
      expect(section).toContain(primitive);
    }
  });

  it("6. the design doc cross-references Alpha 196, 192, and 185", () => {
    for (const ref of [
      "secure_runtime_alpha_196_event_foundation_verification",
      "secure_runtime_alpha_192_nostr_event_handle",
      "secure_runtime_alpha_185_signature_boundary_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the doc's own claims directly against source
  // ---------------------------------------------------------------------

  it("7. structural: exactly one impl FedosNostrEventHandle block exists, with exactly two methods", () => {
    const implMatches = [...libRsSource.matchAll(/impl FedosNostrEventHandle \{/g)];
    expect(implMatches.length).toBe(1);
    const implMatch = libRsSource.match(/impl FedosNostrEventHandle \{([\s\S]*?)\r?\n {4}\}/);
    const body = implMatch?.[1] ?? "";
    const fnCount = [...body.matchAll(/\bfn\s+\w+/g)].length;
    expect(fnCount).toBe(2);
  });

  it("8. structural: neither method on FedosNostrEventHandle takes &mut self", () => {
    const implMatch = libRsSource.match(/impl FedosNostrEventHandle \{([\s\S]*?)\r?\n {4}\}/);
    const body = implMatch?.[1] ?? "";
    expect(body).not.toMatch(/&mut self/);
  });

  it("9. structural: no interior-mutability primitive appears in FedosNostrEventHandle's own struct definition", () => {
    const structMatch = libRsSource.match(/pub\(crate\) struct FedosNostrEventHandle \{([\s\S]*?)\r?\n {4}\}/);
    const body = structMatch?.[1] ?? "";
    for (const primitive of ["Cell<", "RefCell<", "Mutex<", "RwLock<"]) {
      expect(body).not.toContain(primitive);
    }
  });

  it("10. structural: all three consumer functions take event as an immutable borrow, never &mut", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) fn serialize_nostr_event_canonical_internal\(event: &FedosNostrEventHandle\)/,
    );
    expect(libRsSource).toMatch(
      /pub\(crate\) fn derive_nostr_event_id_internal\(event: &FedosNostrEventHandle\)/,
    );
    expect(libRsSource).toMatch(/event: &FedosNostrEventHandle,\s*\r?\n\s*secret_key: &FedosNostrSecretKeyHandle,/);
    expect(libRsSource).not.toMatch(/event: &mut FedosNostrEventHandle/);
  });

  it("11. structural: wasm_bindgen count remains fixed at 13, unchanged by this REVIEW-ONLY Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("12. Regression: lib.rs carries no reference to this Stage's own doc -- confirming zero further change", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_197/);
  });

  it("13. Regression: package.json is untouched", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_197/);
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
  });
});
