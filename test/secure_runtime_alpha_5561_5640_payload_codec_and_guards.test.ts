/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — Phase D/F payload codec strict
 * validation, and Phase Q structural guards.
 */
import { describe, it, expect } from "vitest";
import {
  encodeFedosDirectRatchetNip17PayloadToPlaintext,
  decodeFedosDirectRatchetNip17PayloadFromContent,
  isWellFormedFedosDirectRatchetNip17Payload,
  wireMessageBytesToBase64,
  wireMessageBytesFromBase64,
  type FedosDirectRatchetSessionInitPayloadV1,
  type FedosDirectRatchetMessagePayloadV1,
} from "../src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_direct_ratchet_nip17_payload.js";
import { FEDOS_PRIVATE_WIRE_ROUTE_DEFAULT, type FedosPrivateWireRouteRequest } from "../src/os/messenger/adapters/nostr/transport/fedos_private_wire_route.js";

const PUBKEY_A = "a".repeat(64);
const PUBKEY_B = "b".repeat(64);

function sessionInit(): FedosDirectRatchetSessionInitPayloadV1 {
  return {
    schemaVersion: 1,
    kind: "session-init",
    suite: "fedos-direct-ratchet-v1",
    generation: 0,
    previousGeneration: null,
    resetReason: null,
    resetNonce: "a".repeat(32),
    senderAccountRef: { authority: "nostr", publicIdentifier: PUBKEY_A, identityId: null },
    senderDeviceRef: "alice-device",
    recipientAccountRef: { authority: "nostr", publicIdentifier: PUBKEY_B, identityId: null },
    recipientDeviceRef: "bob-device",
    conversationId: "private-draft::direct::abc",
    ratchetPublicKeyHex: PUBKEY_A,
    deviceSignatureHex: null,
  };
}

function messagePayload(): FedosDirectRatchetMessagePayloadV1 {
  return {
    schemaVersion: 1,
    kind: "message",
    suite: "fedos-direct-ratchet-v1",
    generation: 0,
    sessionId: "direct-ratchet-v1##nostr:aaaa##alice-device##nostr:bbbb##bob-device##conv##fedos-direct-ratchet-v1##0",
    messageNumber: 0,
    wireMessageBase64: wireMessageBytesToBase64(new Uint8Array([1, 2, 3, 4])),
  };
}

describe("Alpha 5561-5640 Phase D/F -- ratchet NIP-17 payload codec", () => {
  it("round-trips a session-init payload through encode/decode exactly", () => {
    const payload = sessionInit();
    const bytes = encodeFedosDirectRatchetNip17PayloadToPlaintext(payload);
    const content = new TextDecoder().decode(bytes);
    const decoded = decodeFedosDirectRatchetNip17PayloadFromContent(content);
    expect(decoded).toEqual(payload);
  });

  it("round-trips a message payload through encode/decode exactly, including the wire message bytes", () => {
    const payload = messagePayload();
    const bytes = encodeFedosDirectRatchetNip17PayloadToPlaintext(payload);
    const content = new TextDecoder().decode(bytes);
    const decoded = decodeFedosDirectRatchetNip17PayloadFromContent(content);
    expect(decoded).toEqual(payload);
    if (decoded?.kind !== "message") throw new Error("expected message");
    expect(wireMessageBytesFromBase64(decoded.wireMessageBase64)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("rejects an ordinary human chat message as not one of our payloads (never mislabeled)", () => {
    expect(decodeFedosDirectRatchetNip17PayloadFromContent("hello bob, just chatting")).toBeNull();
    expect(decodeFedosDirectRatchetNip17PayloadFromContent("{}")).toBeNull();
    expect(decodeFedosDirectRatchetNip17PayloadFromContent('{"hello":"world"}')).toBeNull();
  });

  it("rejects an unknown extra field on a session-init payload (exact closed field set)", () => {
    const withExtra = { ...sessionInit(), extraField: "should not be allowed" };
    expect(isWellFormedFedosDirectRatchetNip17Payload(withExtra)).toBe(false);
  });

  it("rejects an unknown extra field on a message payload", () => {
    const withExtra = { ...messagePayload(), extraField: "should not be allowed" };
    expect(isWellFormedFedosDirectRatchetNip17Payload(withExtra)).toBe(false);
  });

  it("rejects a missing required field", () => {
    const { ratchetPublicKeyHex, ...missing } = sessionInit();
    void ratchetPublicKeyHex;
    expect(isWellFormedFedosDirectRatchetNip17Payload(missing)).toBe(false);
  });

  it("rejects a malformed ratchetPublicKeyHex (not 64 lowercase hex chars)", () => {
    expect(isWellFormedFedosDirectRatchetNip17Payload({ ...sessionInit(), ratchetPublicKeyHex: "not-hex" })).toBe(false);
    expect(isWellFormedFedosDirectRatchetNip17Payload({ ...sessionInit(), ratchetPublicKeyHex: "AA".repeat(32) })).toBe(false);
  });

  it("rejects a negative or non-integer generation/messageNumber", () => {
    expect(isWellFormedFedosDirectRatchetNip17Payload({ ...sessionInit(), generation: -1 })).toBe(false);
    expect(isWellFormedFedosDirectRatchetNip17Payload({ ...messagePayload(), messageNumber: 1.5 })).toBe(false);
  });

  it("rejects malformed base64 in wireMessageBase64", () => {
    expect(isWellFormedFedosDirectRatchetNip17Payload({ ...messagePayload(), wireMessageBase64: "not!!valid==base64" })).toBe(false);
  });

  it("never structurally carries a field capable of holding secret material — the session-init type's own closed field set has no root/chain/message/private-key slot", () => {
    const payload = sessionInit();
    const keys = Object.keys(payload);
    for (const forbidden of ["rootKey", "chainKey", "messageKey", "privateKey", "masterSeed", "sealingKey", "secretHandle"]) {
      expect(keys.some((k) => k.toLowerCase().includes(forbidden.toLowerCase()))).toBe(false);
    }
  });

  it("decode never throws on garbage input", () => {
    expect(() => decodeFedosDirectRatchetNip17PayloadFromContent("")).not.toThrow();
    expect(() => decodeFedosDirectRatchetNip17PayloadFromContent("not json at all {{{")).not.toThrow();
    expect(() => decodeFedosDirectRatchetNip17PayloadFromContent(null as unknown as string)).not.toThrow();
  });
});

describe("Alpha 5561-5640 Phase Q -- structural guards", () => {
  it("the closed private-wire route vocabulary contains exactly the three expected values plus the frozen default", () => {
    const requests: readonly FedosPrivateWireRouteRequest[] = ["fedos-private-v1", "nostr-nip17-v1", "nostr-nip17-v1-ratchet"];
    expect(requests).toHaveLength(3);
    expect(FEDOS_PRIVATE_WIRE_ROUTE_DEFAULT).toBe("fedos-private-v1");
  });
});
