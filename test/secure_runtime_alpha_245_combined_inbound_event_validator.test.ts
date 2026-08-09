import { describe, it, expect } from "vitest";
import { validateInboundNostrEvent } from "../src/desktop/combined_inbound_event_validator.js";
import type { FedosNostrWireEvent } from "../src/desktop/fedos_nostr_wire_event.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_245_combined_inbound_event_validator.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import combinedValidatorSource from "../src/os/messenger/desktop/combined_inbound_event_validator.ts?raw";

const VALID_EVENT: FedosNostrWireEvent = {
  id: "9e4ed05065d5c5135e3843706956fe07b81c635ea3bd9eeddb9e207e82fd0f1d",
  pubkey: "f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9",
  created_at: 1700000300,
  kind: 1,
  tags: [["e", "c".repeat(64)]],
  content:
    'quote:" backslash:\\ newline:\n cr:\r tab:\t backspace:\b formfeed:\f nonascii: héllo 世界 🎉',
  sig: "cf26861991315ab023a2742f11994f2f87cffb587c5add230401e835fbed1798ce7901487a51bde1bd5ab37f4a3fa75ada90bff02ec0c6bbbc1bc327763ba514",
};

/**
 * Secure Runtime Alpha 245 -- "Combined Inbound Event Validator": Stage
 * 5 of the Nostr Inbound Event Validation Arc. Adds
 * src/desktop/combined_inbound_event_validator.ts, exporting
 * validateInboundNostrEvent -- id verification first, then signature
 * verification, null for every failure, deep-cloned + frozen output.
 */
describe("Secure Runtime Alpha 245 -- Combined Inbound Event Validator", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/combined_inbound_event_validator\.ts`\./,
    );
  });

  it("3. structural: validateInboundNostrEvent is the only export, id check strictly precedes signature check", () => {
    const exportNames = [...combinedValidatorSource.matchAll(/^export function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["validateInboundNostrEvent"]);
    const idIndex = combinedValidatorSource.indexOf("verifyNostrEventId(event)");
    const sigIndex = combinedValidatorSource.indexOf("verifyNostrEventSignature(event)");
    expect(idIndex).toBeGreaterThan(-1);
    expect(sigIndex).toBeGreaterThan(-1);
    expect(idIndex).toBeLessThan(sigIndex);
  });

  it("4. structural: the output is Object.freeze'd, and tags are deep-cloned via spread, never a direct reference to event.tags", () => {
    expect(combinedValidatorSource).toMatch(/Object\.freeze\(event\.tags\.map\(\(tag\) => Object\.freeze\(\[\.\.\.tag\]\)\)\)/);
    expect(combinedValidatorSource).toMatch(/return Object\.freeze\(\{/);
  });

  it("5. structural: no reference to src/nostr/* or src/sign/* anywhere in this file", () => {
    expect(combinedValidatorSource).not.toMatch(/from ".*\/(nostr|sign)\//);
  });

  it("6. the design doc cross-references Alpha 244, Alpha 243, Alpha 246, and Alpha 247", () => {
    for (const ref of [
      "secure_runtime_alpha_244_bip340_signature_verification",
      "secure_runtime_alpha_243_canonical_event_id_verification",
      "secure_runtime_alpha_246_validated_subscription_delivery",
      "secure_runtime_alpha_247_validation_failure_semantics",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("7. behavioral: returns a validated event for a real, valid signed event", () => {
    const result = validateInboundNostrEvent(VALID_EVENT);
    expect(result).toEqual(VALID_EVENT);
  });

  it("8. behavioral: returns null for a bad id, with no distinction from a bad signature", () => {
    const badId = validateInboundNostrEvent({ ...VALID_EVENT, id: "00".repeat(32) });
    const badSig = validateInboundNostrEvent({
      ...VALID_EVENT,
      sig: VALID_EVENT.sig.slice(0, -1) + (VALID_EVENT.sig.endsWith("9") ? "8" : "9"),
    });
    expect(badId).toBeNull();
    expect(badSig).toBeNull();
  });

  it("9. behavioral: does not mutate the input event", () => {
    const original = JSON.parse(JSON.stringify(VALID_EVENT));
    validateInboundNostrEvent(VALID_EVENT);
    expect(VALID_EVENT).toEqual(original);
  });

  it("10. behavioral: the returned object and its tags are runtime-frozen, and share no reference with the input's tags", () => {
    const result = validateInboundNostrEvent(VALID_EVENT);
    expect(result).not.toBeNull();
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.tags)).toBe(true);
    expect(result?.tags).not.toBe(VALID_EVENT.tags);
    expect(result?.tags[0]).not.toBe(VALID_EVENT.tags[0]);
    const validated = result!;
    expect(() => {
      // @ts-expect-error intentional runtime mutation attempt
      validated.tags[0][0] = "mutated";
    }).toThrow();
  });

  it("11. behavioral: mutating the original event's tags after validation does not affect the validated output", () => {
    const mutableEvent: FedosNostrWireEvent = {
      ...VALID_EVENT,
      tags: [["e", "c".repeat(64)]],
    };
    const result = validateInboundNostrEvent(mutableEvent);
    expect(result).not.toBeNull();
    (mutableEvent.tags[0] as string[])[0] = "mutated";
    expect(result?.tags[0]?.[0]).toBe("e");
  });
});
