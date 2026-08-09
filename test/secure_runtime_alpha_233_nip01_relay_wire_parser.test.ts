import { describe, it, expect } from "vitest";
import { parseRelayInboundMessage } from "../src/os/messenger/desktop/relay_inbound_parser.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_233_nip01_relay_wire_parser.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import parserSource from "../src/os/messenger/desktop/relay_inbound_parser.ts?raw";

const sampleWireEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_000,
  kind: 1,
  tags: [["e", "c".repeat(64)]],
  content: "hello",
  sig: "d".repeat(128),
};

/**
 * Secure Runtime Alpha 233 -- "NIP-01 Wire Parser": Stage 3 of the
 * Nostr Relay Message Reception Arc. Adds
 * src/desktop/relay_inbound_parser.ts, exporting
 * parseRelayInboundMessage -- a pure, total, never-throwing structural
 * parser for EVENT/EOSE/OK/NOTICE. No cryptographic verification.
 */
describe("Secure Runtime Alpha 233 -- NIP-01 Wire Parser", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/relay_inbound_parser\.ts`\./,
    );
  });

  it("3. structural: parseRelayInboundMessage is the only export, and performs zero crypto/hashing reference IN CODE", () => {
    const exportNames = [...parserSource.matchAll(/^export function (\w+)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(exportNames).toEqual(["parseRelayInboundMessage"]);
    const codeOnly = parserSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/schnorr|sha256|NobleSignatureVerifier|verifyEventId/);
  });

  it("4. structural: no reference to src/nostr/* or src/sign/* anywhere in this file", () => {
    expect(parserSource).not.toMatch(/from ".*\/(nostr|sign)\//);
  });

  it("5. the design doc cross-references Alpha 232, Alpha 234, Alpha 231, and Alpha 235", () => {
    for (const ref of [
      "secure_runtime_alpha_232_relay_inbound_message_model",
      "secure_runtime_alpha_234_inbound_event_representation",
      "secure_runtime_alpha_231_existing_relay_inbound_inventory",
      "secure_runtime_alpha_235_websocket_inbound_wiring",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral: EVENT
  // ---------------------------------------------------------------------

  it("6. behavioral: parses a valid EVENT message, preserving every wire field verbatim", () => {
    const result = parseRelayInboundMessage(["EVENT", "sub-1", sampleWireEvent]);
    expect(result).toEqual({ kind: "event", subscriptionId: "sub-1", event: sampleWireEvent });
  });

  it("7. behavioral: rejects EVENT with a malformed nested event object", () => {
    const malformed = { ...sampleWireEvent, id: "not-hex" };
    expect(parseRelayInboundMessage(["EVENT", "sub-1", malformed])).toBeNull();
  });

  it("8. behavioral: rejects EVENT with a non-string/empty subscription id", () => {
    expect(parseRelayInboundMessage(["EVENT", 42, sampleWireEvent])).toBeNull();
    expect(parseRelayInboundMessage(["EVENT", "", sampleWireEvent])).toBeNull();
  });

  it("9. behavioral: rejects EVENT with the wrong item count", () => {
    expect(parseRelayInboundMessage(["EVENT", "sub-1"])).toBeNull();
    expect(parseRelayInboundMessage(["EVENT", "sub-1", sampleWireEvent, "extra"])).toBeNull();
  });

  // ---------------------------------------------------------------------
  // Behavioral: EOSE
  // ---------------------------------------------------------------------

  it("10. behavioral: parses a valid EOSE message", () => {
    expect(parseRelayInboundMessage(["EOSE", "sub-1"])).toEqual({ kind: "eose", subscriptionId: "sub-1" });
  });

  it("11. behavioral: rejects EOSE with the wrong item count or a non-string id", () => {
    expect(parseRelayInboundMessage(["EOSE"])).toBeNull();
    expect(parseRelayInboundMessage(["EOSE", "sub-1", "extra"])).toBeNull();
    expect(parseRelayInboundMessage(["EOSE", 1])).toBeNull();
  });

  // ---------------------------------------------------------------------
  // Behavioral: OK
  // ---------------------------------------------------------------------

  it("12. behavioral: parses a valid OK message, both accepted states", () => {
    const id = "e".repeat(64);
    expect(parseRelayInboundMessage(["OK", id, true, "stored"])).toEqual({
      kind: "ok",
      eventId: id,
      accepted: true,
      message: "stored",
    });
    expect(parseRelayInboundMessage(["OK", id, false, "duplicate"])).toEqual({
      kind: "ok",
      eventId: id,
      accepted: false,
      message: "duplicate",
    });
  });

  it("13. behavioral: rejects OK with a non-boolean accepted field (no coercion)", () => {
    const id = "e".repeat(64);
    expect(parseRelayInboundMessage(["OK", id, "true", "stored"])).toBeNull();
    expect(parseRelayInboundMessage(["OK", id, 1, "stored"])).toBeNull();
  });

  it("14. behavioral: rejects OK with a malformed event id", () => {
    expect(parseRelayInboundMessage(["OK", "not-hex", true, "stored"])).toBeNull();
  });

  // ---------------------------------------------------------------------
  // Behavioral: NOTICE
  // ---------------------------------------------------------------------

  it("15. behavioral: parses a valid NOTICE message", () => {
    expect(parseRelayInboundMessage(["NOTICE", "rate limited"])).toEqual({
      kind: "notice",
      message: "rate limited",
    });
  });

  it("16. behavioral: rejects NOTICE with a non-string message", () => {
    expect(parseRelayInboundMessage(["NOTICE", 123])).toBeNull();
  });

  // ---------------------------------------------------------------------
  // Behavioral: general malformed input, never throws
  // ---------------------------------------------------------------------

  it("17. behavioral: rejects non-array, empty-array, and unknown-tag input", () => {
    expect(parseRelayInboundMessage("not an array")).toBeNull();
    expect(parseRelayInboundMessage(null)).toBeNull();
    expect(parseRelayInboundMessage(undefined)).toBeNull();
    expect(parseRelayInboundMessage({})).toBeNull();
    expect(parseRelayInboundMessage([])).toBeNull();
    expect(parseRelayInboundMessage(["AUTH", "challenge"])).toBeNull();
    expect(parseRelayInboundMessage([42, "sub-1"])).toBeNull();
  });

  it("18. behavioral: never throws for any malformed input, including deeply hostile shapes", () => {
    const hostileInputs: unknown[] = [
      ["EVENT", "sub-1", null],
      ["EVENT", "sub-1", { toString: () => { throw new Error("hostile"); } }],
      ["OK"],
      ["NOTICE"],
      [Symbol("weird")],
      42,
      true,
    ];
    for (const input of hostileInputs) {
      expect(() => parseRelayInboundMessage(input)).not.toThrow();
    }
  });
});
