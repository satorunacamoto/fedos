import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_426_signed_nostr_event_output_model.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wireEventSource from "../src/os/messenger/desktop/fedos_nostr_wire_event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import validatedEventSource from "../src/os/messenger/desktop/fedos_validated_nostr_event.ts?raw";
// Nostr Consolidation Plan, Step 1 (`docs/architecture/NOSTR-CONSOLIDATION-PLAN.md`)
// unified `FedosNostrWireEvent` with `NostrEvent`: `fedos_nostr_wire_event.ts`
// now re-exports the canonical `protocol/types.ts` definition instead of
// declaring the seven fields literally itself, so the field-shape check
// below reads the canonical source it aliases.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import canonicalNostrEventSource from "../src/os/messenger/adapters/nostr/protocol/types.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync } from "node:fs";

/**
 * Secure Runtime Alpha 426 -- "Signed Event Output Model": Stage 5 of
 * the Alpha 422-430 Arc (Phase A). Design/decision only -- no `.ts`
 * file is shipped this Stage, for the same reason as Alpha 425.
 */
describe("Secure Runtime Alpha 426 -- Signed Event Output Model", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself DESIGN / DECISION ONLY, no src/ file added", () => {
    expect(designDocSource).toMatch(/this Stage is DESIGN \/ DECISION ONLY/);
    expect(designDocSource).toMatch(/no `src\/` file is added/);
  });

  it("3. the design doc decides against a fourth duplicate signed-event type", () => {
    expect(designDocSource).toMatch(/would be this repository's\s*\n\*\*fourth\*\* copy of the same seven-field shape/);
    expect(designDocSource).toMatch(
      /signed-event model without inventory justification\." No such\s*\njustification exists — the shapes are identical\./,
    );
  });

  it("4. structural: FedosNostrWireEvent and FedosValidatedNostrEvent both carry the exact seven NIP-01 wire fields", () => {
    // `fedos_nostr_wire_event.ts` itself is a re-export alias of the
    // canonical `NostrEvent` (Nostr Consolidation Plan, Step 1) -- check
    // the canonical definition it aliases for the field shape, and check
    // `validatedEventSource` (still a real, standalone interface) directly.
    expect(wireEventSource).toMatch(
      /export type \{ NostrEvent as FedosNostrWireEvent \} from ["']\.\.\/adapters\/nostr\/protocol\/types\.js["'];/,
    );
    for (const source of [canonicalNostrEventSource, validatedEventSource]) {
      expect(source).toMatch(/id:/);
      expect(source).toMatch(/pubkey:/);
      expect(source).toMatch(/created_at:/);
      expect(source).toMatch(/kind:/);
      expect(source).toMatch(/tags:/);
      expect(source).toMatch(/content:/);
      expect(source).toMatch(/sig:/);
    }
  });

  it("5. the design doc's candidate output interface uses snake_case created_at, not camelCase createdAt", () => {
    const interfaceBlock = (designDocSource.match(/export interface FedosSignedNostrEventDescriptor \{[\s\S]*?\n\}/) ?? [""])[0];
    expect(interfaceBlock.length).toBeGreaterThan(0);
    expect(interfaceBlock).toMatch(/readonly created_at: number;/);
    expect(interfaceBlock).not.toMatch(/createdAt/);
  });

  it("6. the design doc requires independent verifiability through the existing, unmodified validateInboundNostrEvent", () => {
    expect(designDocSource).toMatch(/validateInboundNostrEvent/);
  });

  it("7. the design doc cross-references Alpha 425 and Alpha 422", () => {
    for (const ref of [
      "secure_runtime_alpha_425_nostr_signing_input_model",
      "secure_runtime_alpha_422_nostr_signing_boundary_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("8. no signed-event output model source file exists as a result of this Stage", () => {
    expect(existsSync("src/desktop/fedos_nostr_signing_authority.ts")).toBe(false);
  });
});
