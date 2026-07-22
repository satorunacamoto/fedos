/**
 * Secure Runtime Alpha 1611–1690 ("Nostr Private Wire Standardization
 * and Transport Reconciliation Arc") — Alpha 1612 (Current-Wire Safety
 * Audit) + Alpha 1615 (Kind-1 Closure) + Alpha 1650 (Kind-1 Regression
 * Guard).
 *
 * Alpha 1612's own mechanical audit found that
 * `buildFedosPrivateTransportUnsignedEventRequest()`
 * (`../src/conversation/transport/fedos_conversation_transport_event.ts`)
 * hard-fixed `kind: 1` for `FedosPrivateTransport`'s own private,
 * ciphertext-carrying wire events — Primary Problem item B. This file's
 * first test (`1.`) is the regression test Alpha 1612 requires be
 * written and shown FAILING before the Alpha 1615 fix; every other test
 * here proves the fix, and Alpha 1650's own guard that public Board
 * `kind: 1` behavior is untouched.
 *
 * `FEDOS_PRIVATE_TRANSPORT_MARKER_TAG` and `["p", ...]`/`["e-envelope",
 * ...]` tags are UNCHANGED by this Arc — only the wire `kind` moves,
 * from `1` to the SAME disclosed `FEDOS_PRIVATE_NOSTR_DELIVERY_KIND`
 * (`24700`) the proprietary `privateNostrDelivery()` facade (Alpha
 * 1391–1470) already uses — no new kind is invented, and the Nostr
 * Signing Authority's own closed two-value allowlist (Alpha 1399/1402)
 * already permits exactly this value, unchanged.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";
import {
  buildFedosPrivateTransportUnsignedEventRequest,
  parseFedosPrivateTransportEventDescriptor,
  FEDOS_PRIVATE_TRANSPORT_MARKER_TAG,
} from "../src/conversation/transport/fedos_conversation_transport_event.js";
import { FEDOS_PRIVATE_NOSTR_DELIVERY_KIND } from "../src/conversation/delivery/nostr/fedos_private_nostr_delivery_mode.js";
import { isWellFormedFedosNostrUnsignedEventRequest } from "../src/nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosConversationMessageEnvelope } from "../src/conversation/envelope/fedos_conversation_message_envelope.js";
import type { FedosEventDescriptor } from "../src/desktop/fedos_event_descriptor.js";

const COUNTERPARTY_PUBKEY = "b".repeat(64);
const LOCAL_PUBKEY = "a".repeat(64);

function fakeEnvelope(overrides: Partial<FedosConversationMessageEnvelope> = {}): FedosConversationMessageEnvelope {
  return Object.freeze({
    id: "envelope-1" as never,
    conversationId: "conversation-1" as never,
    senderMembershipId: "membership-1" as never,
    payloadId: "payload-1" as never,
    encryptionSuite: "ChaCha20Poly1305",
    keyEpoch: 0,
    createdAt: 1_700_000_000,
    replyToEnvelopeId: null,
    ...overrides,
  });
}

function descriptorFrom(tags: readonly (readonly string[])[], content: string, kind: number): FedosEventDescriptor {
  return Object.freeze({
    id: "event-1",
    provider: "nostr",
    author: LOCAL_PUBKEY,
    createdAt: 1_700_000_000,
    kind,
    tags,
    content,
    signature: "sig",
  });
}

describe("Secure Runtime Alpha 1611-1690 -- Alpha 1612/1615/1650: Private Transport never emits kind 1", () => {
  it("1. (Alpha 1612 audit finding, closed by Alpha 1615) a built private-transport unsigned event request is NEVER kind 1 -- it carries the SAME disclosed proprietary kind privateNostrDelivery() already uses", () => {
    const request = buildFedosPrivateTransportUnsignedEventRequest({
      envelope: fakeEnvelope(),
      ciphertext: new Uint8Array([1, 2, 3]),
      counterpartyPublicKeyHex: COUNTERPARTY_PUBKEY,
      localAccountIndex: 0,
    });
    expect(request.kind).not.toBe(1);
    expect(request.kind).toBe(FEDOS_PRIVATE_NOSTR_DELIVERY_KIND);
  });

  it("2. the built request is still well-formed against the Nostr Signing Authority's own closed allowlist (no widened allowlist was needed -- 24700 was already permitted since Alpha 1399/1402)", () => {
    const request = buildFedosPrivateTransportUnsignedEventRequest({
      envelope: fakeEnvelope(),
      ciphertext: new Uint8Array([1, 2, 3]),
      counterpartyPublicKeyHex: COUNTERPARTY_PUBKEY,
      localAccountIndex: 0,
    });
    expect(isWellFormedFedosNostrUnsignedEventRequest(request)).toBe(true);
  });

  it("3. parse is still the exact inverse of build, now at the proprietary kind", () => {
    const ciphertext = new Uint8Array([9, 8, 7]);
    const request = buildFedosPrivateTransportUnsignedEventRequest({
      envelope: fakeEnvelope(),
      ciphertext,
      counterpartyPublicKeyHex: COUNTERPARTY_PUBKEY,
      localAccountIndex: 0,
    });
    const descriptor = descriptorFrom(request.tags, request.content, request.kind);
    const parsed = parseFedosPrivateTransportEventDescriptor(descriptor);
    expect(parsed).not.toBeNull();
    expect(parsed?.envelopeId).toBe("envelope-1");
    expect(parsed?.recipientPublicKeyHex).toBe(COUNTERPARTY_PUBKEY);
    expect(parsed?.ciphertext).toEqual(ciphertext);
  });

  it("4. (Alpha 1650 guard) the inbound classifier now REJECTS a kind-1 event even if it carries every private-transport tag -- kind 1 is no longer a valid private-transport wire shape at all", () => {
    const descriptor = descriptorFrom(
      [[...FEDOS_PRIVATE_TRANSPORT_MARKER_TAG], ["p", COUNTERPARTY_PUBKEY], ["e-envelope", "envelope-1"]],
      Buffer.from(new Uint8Array([1, 2, 3])).toString("base64"),
      1,
    );
    expect(parseFedosPrivateTransportEventDescriptor(descriptor)).toBeNull();
  });

  it("5. (Alpha 1650 guard) a public Board kind-1 post is still never misclassified as a private-transport event -- unrelated to this Arc's own change, reconfirmed unchanged", () => {
    const descriptor = descriptorFrom([["e", "some-thread-root"]], "hello board", 1);
    expect(parseFedosPrivateTransportEventDescriptor(descriptor)).toBeNull();
  });

  it("6. (Alpha 1650 guard) the classifier still rejects the WRONG proprietary-adjacent kind (e.g. one accidentally off by one) -- only the exact FEDOS_PRIVATE_NOSTR_DELIVERY_KIND is accepted, never a fuzzy match", () => {
    const descriptor = descriptorFrom(
      [[...FEDOS_PRIVATE_TRANSPORT_MARKER_TAG], ["p", COUNTERPARTY_PUBKEY], ["e-envelope", "envelope-1"]],
      Buffer.from(new Uint8Array([1, 2, 3])).toString("base64"),
      FEDOS_PRIVATE_NOSTR_DELIVERY_KIND + 1,
    );
    expect(parseFedosPrivateTransportEventDescriptor(descriptor)).toBeNull();
  });
});
