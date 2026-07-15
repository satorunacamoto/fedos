import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_425_nostr_signing_input_model.md?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync } from "node:fs";

/**
 * Secure Runtime Alpha 425 -- "Nostr Signing Input Model": Stage 4 of
 * the Alpha 422-430 Arc (Phase A). Design/decision only -- no `.ts`
 * file is shipped this Stage (see the doc's own §0/intro reasoning:
 * Phase B does not proceed past Alpha 427, so an unconsumed exported
 * type would be dead code).
 */
describe("Secure Runtime Alpha 425 -- Nostr Signing Input Model", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself DESIGN / DECISION ONLY, no src/ file added", () => {
    expect(designDocSource).toMatch(/this Stage is DESIGN \/ DECISION ONLY/);
    expect(designDocSource).toMatch(/no `src\/` file is added/);
  });

  it("3. the design doc's candidate interface matches the five required fields exactly", () => {
    expect(designDocSource).toMatch(/readonly accountIndex: number;/);
    expect(designDocSource).toMatch(/readonly createdAt: number;/);
    expect(designDocSource).toMatch(/readonly kind: number;/);
    expect(designDocSource).toMatch(/readonly tags: readonly \(readonly string\[\]\)\[\];/);
    expect(designDocSource).toMatch(/readonly content: string;/);
  });

  it("4. the design doc's candidate interface carries no pubkey, id, sig, or secret field", () => {
    const interfaceBlock = (designDocSource.match(/export interface FedosNostrUnsignedEventRequest \{[\s\S]*?\n\}/) ?? [""])[0];
    expect(interfaceBlock.length).toBeGreaterThan(0);
    expect(interfaceBlock).not.toMatch(/pubkey/);
    expect(interfaceBlock).not.toMatch(/\bid:/);
    expect(interfaceBlock).not.toMatch(/\bsig:/);
    expect(interfaceBlock).not.toMatch(/secret/i);
  });

  it("5. the design doc fixes the fail-closed malformed-input policy", () => {
    expect(designDocSource).toMatch(/Fails closed/);
  });

  it("6. the design doc cross-references Alpha 424 and Alpha 422", () => {
    for (const ref of [
      "secure_runtime_alpha_424_nostr_signing_authority_scope",
      "secure_runtime_alpha_422_nostr_signing_boundary_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("7. no signing input model source file exists as a result of this Stage", () => {
    expect(existsSync("src/desktop/fedos_nostr_signing_authority.ts")).toBe(false);
  });
});
