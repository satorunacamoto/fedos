import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_421_existing_nostr_outbound_construction_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nobleSignatureSource from "../src/nostr/noble_signature.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import signatureSource from "../src/nostr/signature.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync } from "node:fs";

/**
 * Secure Runtime Alpha 421 -- "Existing Nostr Outbound Construction
 * Inventory": Stage 1 of the Alpha 421-430 Nostr Outbound Board
 * Publisher Foundation Arc (Phase B). Review only. CONCLUDES Phase B is
 * blocked -- see the design doc's own §4.
 */
describe("Secure Runtime Alpha 421 -- Existing Nostr Outbound Construction Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. structural: FedosNostrSecretKeyHandle is pub(crate), never pub", () => {
    expect(libRsSource).toMatch(/pub\(crate\) struct FedosNostrSecretKeyHandle \{/);
    expect(libRsSource).not.toMatch(/^pub struct FedosNostrSecretKeyHandle/m);
  });

  it("3. structural: the internal Nostr derivation functions are pub(crate), never pub or wasm_bindgen-exported", () => {
    for (const fn of [
      "derive_nostr_root_internal",
      "derive_nostr_secret_key_internal",
      "derive_nostr_public_key_internal",
      "derive_nostr_signature_internal",
    ]) {
      expect(libRsSource, fn).toMatch(new RegExp(`pub\\(crate\\) fn ${fn}`));
      expect(libRsSource, fn).not.toMatch(new RegExp(`\\n#\\[wasm_bindgen\\]\\s*\\npub\\(crate\\) fn ${fn}`));
    }
  });

  it("4. structural: zero #[wasm_bindgen] export sits within 5 lines above any Nostr-signing-named function", () => {
    // Line-start-anchored -- Alpha 869 added a doc comment elsewhere in
    // this file that legitimately NAMES `` `#[wasm_bindgen]` `` in prose
    // (describing a helper reachable from a real, unrelated
    // wasm_bindgen-annotated caller); an actually-applied attribute
    // always starts its own line, prose mentioning it does not.
    const wasmBindgenBlocks = libRsSource.match(/^#\[wasm_bindgen\][\s\S]{0,400}/gm) ?? [];
    const signingRelated = wasmBindgenBlocks.filter((block: string) =>
      /nostr|schnorr|sign_event|NostrSecretKey/i.test(block),
    );
    expect(signingRelated).toEqual([]);
  });

  it("5. structural: src/nostr/noble_signature.ts documents itself as verify-only, no private keys", () => {
    expect(nobleSignatureSource).toMatch(/This module verifies only; it never signs\. No private keys are involved\./);
  });

  it("6. structural: src/nostr/signature.ts defines no sign() method on SignatureVerifier", () => {
    expect(signatureSource).toMatch(/verify\(event: NostrEvent\): Promise<boolean>;/);
    expect(signatureSource).not.toMatch(/sign\(/);
  });

  it("7. the design doc's critical finding quotes the Arc's own binding STOP AND REPORT instruction", () => {
    expect(designDocSource).toMatch(/STOP AND\s*\n?> REPORT before implementing a second signing stack/);
  });

  it("8. the design doc concludes Phase B (Alpha 422-430) is not attempted", () => {
    expect(designDocSource).toMatch(/Phase B \(Alpha 422–430\) is not attempted/);
  });

  it("9. src/board/publish did not exist as a result of this Stage's own conclusion -- fulfilled later, by Alpha 451-460", () => {
    // Alpha 451-460 (Canonical Nostr Outbound Publisher Foundation Arc) later
    // fulfills the Publisher this Stage's own inventory found missing. See
    // docs/secure_runtime_alpha_460_nostr_outbound_publisher_foundation_completion.md.
    expect(existsSync("src/board/publish")).toBe(true);
  });

  it("10. the design doc cross-references Alpha 420, Alpha 163, and Alpha 182", () => {
    for (const ref of [
      "secure_runtime_alpha_420_outbox_foundation_completion",
      "secure_runtime_alpha_163_nostr_secret_key_handle",
      "secure_runtime_alpha_182_nostr_signature_handle",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
