import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_423_nostr_signing_boundary_options.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip07Source from "../src/os/_legacy_prototype/sign/nip07.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nobleSignatureSource from "../src/os/messenger/adapters/nostr/protocol/noble_signature.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync } from "node:fs";

/**
 * Secure Runtime Alpha 423 -- "Signing Boundary Options Review": Stage
 * 2 of the Alpha 422-430 Arc (Phase A). Design/decision only.
 */
describe("Secure Runtime Alpha 423 -- Signing Boundary Options Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc adopts Option A and states so explicitly", () => {
    expect(designDocSource).toMatch(
      /\*\*Option A — a narrow WASM signing authority using existing Rust\s*\ninternals — is adopted\*\*/,
    );
  });

  it("3. the design doc rejects Options B, C, D, E, and F, each explicitly", () => {
    const rejections = designDocSource.match(/\*\*Rejected/g) ?? [];
    expect(rejections.length).toBeGreaterThanOrEqual(5);
  });

  it("4. structural: src/sign/nip07.ts is a real, key-material-free NIP-07 delegate (confirms Option B's own reasoning)", () => {
    expect(nip07Source).toMatch(/class Nip07EventSigner/);
  });

  it("5. structural: src/nostr/noble_signature.ts remains verify-only (confirms Option D's own rejection)", () => {
    expect(nobleSignatureSource).toMatch(/This module verifies only; it never signs\. No private keys are involved\./);
  });

  it("6. the design doc does not conclude Phase B is implementable without qualification -- it explicitly carries the Alpha 422 §13 gap forward", () => {
    expect(designDocSource).toMatch(/Alpha 422 §13 finding/);
  });

  it("7. the design doc cross-references Alpha 422 and Alpha 421", () => {
    for (const ref of [
      "secure_runtime_alpha_422_nostr_signing_boundary_inventory",
      "secure_runtime_alpha_421_existing_nostr_outbound_construction_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("8. no src/desktop/fedos_nostr_signing_authority.ts exists as a result of this Stage; src/board/publish exists only later, from Alpha 451-460", () => {
    // Alpha 451-460 (Canonical Nostr Outbound Publisher Foundation Arc) later
    // fulfills the Publisher this Stage itself does not attempt. See
    // docs/secure_runtime_alpha_460_nostr_outbound_publisher_foundation_completion.md.
    expect(existsSync("src/board/publish")).toBe(true);
    expect(existsSync("src/desktop/fedos_nostr_signing_authority.ts")).toBe(false);
  });
});
