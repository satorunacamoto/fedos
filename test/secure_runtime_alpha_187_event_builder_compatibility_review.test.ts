import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_187_event_builder_compatibility_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrTypesSource from "../src/os/messenger/adapters/nostr/protocol/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrEventSource from "../src/os/messenger/adapters/nostr/protocol/event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Secure Runtime Alpha 187 -- "Future Event Builder Compatibility
 * Review": Stage 7 of the Nostr Schnorr Signing Foundation Arc (Alpha
 * 181-190). REVIEW ONLY -- zero code change. Confirms Alpha 182/183's
 * own shipped shape already fits a future Event Builder's needs, and
 * names what is still explicitly missing without building any of it.
 */
describe("Secure Runtime Alpha 187 -- Future Event Builder Compatibility Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW ONLY", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change of any\s*\nkind/);
  });

  it("3. the design doc's fit-confirmation covers input shape, output shape, and determinism", () => {
    const section = (designDocSource.match(/## 3\. Fit confirmed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Input shape\*\*/);
    expect(section).toMatch(/\*\*Output shape\*\*/);
    expect(section).toMatch(/\*\*Determinism\*\*/);
    expect(section).toMatch(/No change to Alpha 182\/183's own shipped shape is needed or\s*\nrecommended\./);
  });

  it("4. the design doc names all four explicitly missing pieces without building any of them", () => {
    const section = (designDocSource.match(/## 4\. What is explicitly still MISSING([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*A hex Encoder for the 64-byte signature\.\*\*/);
    expect(section).toMatch(/\*\*Event serialization\.\*\*/);
    expect(section).toMatch(/\*\*A `kind`\/`tags`\/`content`\/`created_at` assembly API\.\*\*/);
    expect(section).toMatch(/\*\*A public, `wasm_bindgen`-exported entry point\.\*\*/);
  });

  it("5. the design doc cross-references Alpha 186, 182, 173, and the Nostr adapter planning doc", () => {
    for (const ref of [
      "secure_runtime_alpha_186_public_key_interoperability_review",
      "secure_runtime_alpha_182_nostr_signature_handle",
      "secure_runtime_alpha_173_nostr_public_identifier_encoder",
      "nostr_adapter_planning",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the doc's own claims directly against source
  // ---------------------------------------------------------------------

  it("6. structural: NostrEvent.sig is documented as a 64-byte lowercase hex schnorr signature, unchanged", () => {
    expect(nostrTypesSource).toMatch(/64-byte lowercase hex schnorr signature\./);
  });

  it("7. structural: derive_nostr_signature_internal's message parameter is exactly [u8; 32], matching computeEventId's own output shape", () => {
    expect(libRsSource).toMatch(/message: &\[u8; 32\],/);
  });

  it("8. RIPPLE (Secure Runtime Alpha 195): no Event construction/build/sign function of any name existed in lib.rs AS OF this Stage's own closing state; Stage 1035 (Secure Runtime Alpha 195) legitimately added `sign_nostr_event_internal`/`new_nostr_event_internal` in a LATER Arc, connecting Event ID generation to the Schnorr Signature foundation this Stage's own §3 already named as the exact future call shape -- `build_nostr_event`/`create_event` remain absent by those exact names, reconfirmed here as the CURRENT state", () => {
    expect(libRsSource).not.toMatch(/fn\s+build_nostr_event|fn\s+create_event/);
  });

  it("9. structural: wasm_bindgen count remains fixed at 13, unchanged by this REVIEW-ONLY Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("10. Regression: lib.rs, src/nostr/types.ts, and src/nostr/event.ts carry no reference to this Stage's own doc", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_187/);
    expect(nostrTypesSource).not.toMatch(/secure_runtime_alpha_187/);
    expect(nostrEventSource).not.toMatch(/secure_runtime_alpha_187/);
  });

  it("11. Regression: package.json is untouched", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_187/);
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
  });
});
