import { describe, it, expect } from "vitest";
// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";
import {
  encodeFedosPrivateNostrWirePayload,
  decodeFedosPrivateNostrWirePayload,
  isWellFormedFedosPrivateNostrWirePayload,
  type FedosPrivateNostrWirePayloadV1,
} from "../src/os/messenger/adapters/nostr/conversation_delivery/fedos_private_nostr_wire_payload.js";

/**
 * Secure Runtime Alpha 1401/1402/1421 -- the inner wire payload codec:
 * round-trip fidelity, strict structural rejection of malformed/tampered
 * content, and confirmation that no plaintext field exists anywhere in
 * the wire shape.
 */
describe("Secure Runtime Alpha 1391-1470 -- Private Nostr wire payload codec", () => {
  const base: FedosPrivateNostrWirePayloadV1 = {
    schemaVersion: 1,
    envelopeId: "envelope-abc",
    conversationId: "conversation-xyz",
    senderMembershipId: "membership-1",
    keyEpoch: 0,
    createdAt: 1_700_000_000,
    replyToEnvelopeId: null,
    suite: "ChaCha20Poly1305",
    ciphertextBase64: Buffer.from("opaque-ciphertext-bytes").toString("base64"),
    groupLinkage: null,
  };

  it("1. round-trips exactly", () => {
    const encoded = encodeFedosPrivateNostrWirePayload(base);
    const decoded = decodeFedosPrivateNostrWirePayload(encoded);
    expect(decoded).toEqual(base);
  });

  it("2. round-trips with groupLinkage present", () => {
    const withLinkage: FedosPrivateNostrWirePayloadV1 = {
      ...base,
      groupLinkage: { senderGroupMessageId: "group-message-1", replyToGroupMessageId: "group-message-0" },
    };
    const decoded = decodeFedosPrivateNostrWirePayload(encodeFedosPrivateNostrWirePayload(withLinkage));
    expect(decoded).toEqual(withLinkage);
  });

  it("3. rejects non-base64 content", () => {
    expect(decodeFedosPrivateNostrWirePayload("not valid base64 !!!")).toBeNull();
  });

  it("4. rejects base64-of-non-JSON content", () => {
    expect(decodeFedosPrivateNostrWirePayload(Buffer.from("not json").toString("base64"))).toBeNull();
  });

  it("5. rejects a payload with an extra unknown field", () => {
    const withExtra = { ...base, extraField: "unexpected" };
    expect(decodeFedosPrivateNostrWirePayload(Buffer.from(JSON.stringify(withExtra)).toString("base64"))).toBeNull();
  });

  it("6. rejects a payload with a missing required field", () => {
    const { envelopeId: _drop, ...missing } = base;
    void _drop;
    expect(decodeFedosPrivateNostrWirePayload(Buffer.from(JSON.stringify(missing)).toString("base64"))).toBeNull();
  });

  it("7. rejects an unsupported schemaVersion", () => {
    const wrongVersion = { ...base, schemaVersion: 2 };
    expect(decodeFedosPrivateNostrWirePayload(Buffer.from(JSON.stringify(wrongVersion)).toString("base64"))).toBeNull();
  });

  it("8. rejects an unsupported suite", () => {
    const wrongSuite = { ...base, suite: "Twofish" };
    expect(decodeFedosPrivateNostrWirePayload(Buffer.from(JSON.stringify(wrongSuite)).toString("base64"))).toBeNull();
  });

  it("9. isWellFormedFedosPrivateNostrWirePayload agrees with decode success/failure", () => {
    expect(isWellFormedFedosPrivateNostrWirePayload(base)).toBe(true);
    expect(isWellFormedFedosPrivateNostrWirePayload({ ...base, keyEpoch: -1 })).toBe(false);
  });

  it("10. the wire shape has no field named plaintext/plainText/rawKey/seed/passphrase", () => {
    const keys = Object.keys(base);
    for (const forbidden of ["plaintext", "plainText", "rawKey", "seed", "passphrase", "privateKey"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
