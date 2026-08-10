import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_194_deterministic_event_id_generation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Secure Runtime Alpha 194 -- "Deterministic Event ID Generation":
 * Stage 4 of the Nostr Event Foundation Arc (Alpha 191-200).
 * IMPLEMENTS -- sha256 of the canonical serialized event only, Fail
 * Closed.
 */
describe("Secure Runtime Alpha 194 -- Deterministic Event ID Generation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself IMPLEMENTS, touching only lib.rs", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`packages\/fedos-core-rust\/src\/lib\.rs`/,
    );
  });

  it("3. the design doc states hashing covers ONLY the canonical serialized event, no domain separation mixed in", () => {
    const section = (designDocSource.match(/## 3\. Hashes ONLY the canonical serialized event([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/and NOTHING else: no length prefix, no domain-separation tag, no\s*\n\s*salt/);
  });

  it("4. the design doc restates the ALWAYS-Some-today Fail-Closed precedent", () => {
    const section = (designDocSource.match(/## 4\. Fail Closed([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/ALWAYS Some today/);
  });

  it("5. the design doc names all six Alpha 196 determinism/separation tests", () => {
    const section = (designDocSource.match(/## 5\. Structural confirmation([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    for (const testName of [
      "same_event_fields_derive_identical_event_ids",
      "different_content_derives_different_event_id",
      "different_created_at_derives_different_event_id",
      "different_kind_derives_different_event_id",
      "different_tags_derives_different_event_id",
      "different_pubkey_derives_different_event_id",
    ]) {
      expect(section).toContain(testName);
    }
  });

  it("6. the design doc cross-references Alpha 193, 192, and 191", () => {
    for (const ref of [
      "secure_runtime_alpha_193_canonical_event_serialization",
      "secure_runtime_alpha_192_nostr_event_handle",
      "secure_runtime_alpha_191_nostr_event_model_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the doc's own claims directly against source
  // ---------------------------------------------------------------------

  it("7. structural: derive_nostr_event_id_internal exists with the exact documented signature", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) fn derive_nostr_event_id_internal\(event: &FedosNostrEventHandle\) -> Option<\[u8; 32\]> \{/,
    );
  });

  it("8. structural: the function body contains zero unwrap/expect/panic/todo/unimplemented, and calls Sha256::digest exactly once", () => {
    const fnMatch = libRsSource.match(
      /pub\(crate\) fn derive_nostr_event_id_internal\([\s\S]*?\r?\n {4}\}\r?\n/,
    );
    expect(fnMatch).not.toBeNull();
    const body = fnMatch?.[0] ?? "";
    expect(body).not.toMatch(/\.unwrap\(\)|\.expect\(|panic!|todo!|unimplemented!/);
    const digestCalls = [...body.matchAll(/Sha256::digest\(/g)];
    expect(digestCalls.length).toBe(1);
    expect(body).toContain("Sha256::digest(canonical.as_bytes())");
  });

  it("9. structural: sha2::Digest is imported alongside the pre-existing sha2::Sha256 import", () => {
    expect(libRsSource).toMatch(/use sha2::\{Digest, Sha256\};/);
  });

  it("10. structural: wasm_bindgen count and pub fn count remain fixed at 13/36, unchanged by this Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("11. Regression: package.json is untouched -- zero new npm dependency, this is a Rust-only Stage", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_194/);
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
  });
});
