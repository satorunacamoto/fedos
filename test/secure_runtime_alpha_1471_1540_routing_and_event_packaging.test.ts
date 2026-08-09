import { describe, it, expect } from "vitest";
// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";
import { resolveFedosConversationTransportRoute } from "../src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_routing.js";
import {
  buildFedosPrivateTransportUnsignedEventRequest,
  parseFedosPrivateTransportEventDescriptor,
  FEDOS_PRIVATE_TRANSPORT_MARKER_TAG,
} from "../src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_event.js";
import { FEDOS_PRIVATE_NOSTR_DELIVERY_KIND } from "../src/os/messenger/adapters/nostr/conversation_delivery/fedos_private_nostr_delivery_mode.js";
import type { FedosConversationMembership } from "../src/os/messenger/conversations/membership/fedos_conversation_membership.js";
import type { FedosNostrSigningAuthority } from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { FedosConversationMessageEnvelope } from "../src/os/messenger/conversations/envelope/fedos_conversation_message_envelope.js";
import type { FedosEventDescriptor } from "../src/os/messenger/desktop/fedos_event_descriptor.js";

const LOCAL_PUBKEY = "a".repeat(64);
const COUNTERPARTY_PUBKEY = "b".repeat(64);

function membership(participantHex: string, state: "active" | "revoked" | "left" = "active"): FedosConversationMembership {
  return Object.freeze({
    id: `membership-${participantHex}` as never,
    conversationId: "conversation-1" as never,
    participant: { authority: "nostr" as const, publicIdentifier: participantHex, identityId: null },
    role: "member" as never,
    state,
    joinedAt: 0,
    endedAt: null,
  });
}

function fakeSigningAuthority(publicKeyHex: string | null): FedosNostrSigningAuthority {
  return {
    async signEvent() {
      throw new Error("not used");
    },
    async publicIdentityForAccount(accountIndex: number) {
      return publicKeyHex === null ? null : { accountIndex, publicKeyHex };
    },
  };
}

describe("Secure Runtime Alpha 1471-1540 -- Routing Resolution (Identity Resolution reuse)", () => {
  it("1. resolves a Direct conversation's route from two active memberships", async () => {
    const result = await resolveFedosConversationTransportRoute({
      memberships: [membership(LOCAL_PUBKEY), membership(COUNTERPARTY_PUBKEY)],
      signingAuthority: fakeSigningAuthority(LOCAL_PUBKEY),
      localAccountIndex: 0,
    });
    expect(result).toEqual({ outcome: "resolved", localAccountIndex: 0, counterpartyPublicKeyHex: COUNTERPARTY_PUBKEY });
  });

  it("2. fails closed to not-direct for a group conversation (more than two active memberships)", async () => {
    const result = await resolveFedosConversationTransportRoute({
      memberships: [membership(LOCAL_PUBKEY), membership(COUNTERPARTY_PUBKEY), membership("c".repeat(64))],
      signingAuthority: fakeSigningAuthority(LOCAL_PUBKEY),
      localAccountIndex: 0,
    });
    expect(result).toEqual({ outcome: "not-direct" });
  });

  it("3. fails closed to not-direct when a membership has ended (only one active remains)", async () => {
    const result = await resolveFedosConversationTransportRoute({
      memberships: [membership(LOCAL_PUBKEY), membership(COUNTERPARTY_PUBKEY, "left")],
      signingAuthority: fakeSigningAuthority(LOCAL_PUBKEY),
      localAccountIndex: 0,
    });
    expect(result).toEqual({ outcome: "not-direct" });
  });

  it("4. fails closed to local-membership-unresolved when the signing authority has no identity", async () => {
    const result = await resolveFedosConversationTransportRoute({
      memberships: [membership(LOCAL_PUBKEY), membership(COUNTERPARTY_PUBKEY)],
      signingAuthority: fakeSigningAuthority(null),
      localAccountIndex: 0,
    });
    expect(result).toEqual({ outcome: "local-membership-unresolved" });
  });

  it("5. fails closed to local-membership-unresolved when neither membership matches the local identity", async () => {
    const result = await resolveFedosConversationTransportRoute({
      memberships: [membership("c".repeat(64)), membership(COUNTERPARTY_PUBKEY)],
      signingAuthority: fakeSigningAuthority(LOCAL_PUBKEY),
      localAccountIndex: 0,
    });
    expect(result).toEqual({ outcome: "local-membership-unresolved" });
  });

  it("6. fails closed to invalid-counterparty-key for a malformed (non-hex) counterparty identifier", async () => {
    const badCounterparty: FedosConversationMembership = Object.freeze({
      ...membership("not-a-valid-hex-key"),
    });
    const result = await resolveFedosConversationTransportRoute({
      memberships: [membership(LOCAL_PUBKEY), badCounterparty],
      signingAuthority: fakeSigningAuthority(LOCAL_PUBKEY),
      localAccountIndex: 0,
    });
    expect(result).toEqual({ outcome: "invalid-counterparty-key" });
  });

  it("7. fails closed to counterparty-not-nostr when the other participant is not a Nostr authority", async () => {
    const nonNostr: FedosConversationMembership = Object.freeze({
      id: "membership-other" as never,
      conversationId: "conversation-1" as never,
      participant: { authority: "activitypub" as const, publicIdentifier: "someone@example.com", identityId: null },
      role: "member" as never,
      state: "active",
      joinedAt: 0,
      endedAt: null,
    });
    const result = await resolveFedosConversationTransportRoute({
      memberships: [membership(LOCAL_PUBKEY), nonNostr],
      signingAuthority: fakeSigningAuthority(LOCAL_PUBKEY),
      localAccountIndex: 0,
    });
    expect(result).toEqual({ outcome: "counterparty-not-nostr" });
  });
});

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

describe("Secure Runtime Alpha 1471-1540 -- Wire Packaging (kind fixed to the shared FedOS proprietary kind since Alpha 1615, no new crypto)", () => {
  it("1. builds an unsigned event request with the shared proprietary kind (Alpha 1615 -- never kind 1), the marker tag, the p tag, and base64 content", () => {
    const ciphertext = new Uint8Array([1, 2, 3, 4, 5]);
    const request = buildFedosPrivateTransportUnsignedEventRequest({
      envelope: fakeEnvelope(),
      ciphertext,
      counterpartyPublicKeyHex: COUNTERPARTY_PUBKEY,
      localAccountIndex: 0,
    });
    expect(request.kind).toBe(FEDOS_PRIVATE_NOSTR_DELIVERY_KIND);
    expect(request.accountIndex).toBe(0);
    expect(request.createdAt).toBe(1_700_000_000);
    expect(request.tags).toContainEqual([...FEDOS_PRIVATE_TRANSPORT_MARKER_TAG]);
    expect(request.tags).toContainEqual(["p", COUNTERPARTY_PUBKEY]);
    expect(request.tags).toContainEqual(["e-envelope", "envelope-1"]);
    expect(Buffer.from(request.content, "base64")).toEqual(Buffer.from(ciphertext));
  });

  function descriptorFrom(tags: readonly (readonly string[])[], content: string, kind = FEDOS_PRIVATE_NOSTR_DELIVERY_KIND): FedosEventDescriptor {
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

  it("2. parse is the exact inverse of build for a well-formed descriptor", () => {
    const ciphertext = new Uint8Array([9, 8, 7]);
    const request = buildFedosPrivateTransportUnsignedEventRequest({
      envelope: fakeEnvelope(),
      ciphertext,
      counterpartyPublicKeyHex: COUNTERPARTY_PUBKEY,
      localAccountIndex: 0,
    });
    const descriptor = descriptorFrom(request.tags, request.content);
    const parsed = parseFedosPrivateTransportEventDescriptor(descriptor);
    expect(parsed).not.toBeNull();
    expect(parsed?.envelopeId).toBe("envelope-1");
    expect(parsed?.recipientPublicKeyHex).toBe(COUNTERPARTY_PUBKEY);
    expect(parsed?.ciphertext).toEqual(ciphertext);
  });

  it("3. rejects an event at the wrong kind (including, per Alpha 1615's own Kind-1 Closure, kind 1 itself -- see also test/secure_runtime_alpha_1611_1690_kind1_closure.test.ts)", () => {
    const descriptor = descriptorFrom(
      [[...FEDOS_PRIVATE_TRANSPORT_MARKER_TAG], ["p", COUNTERPARTY_PUBKEY], ["e-envelope", "envelope-1"]],
      "",
      7,
    );
    expect(parseFedosPrivateTransportEventDescriptor(descriptor)).toBeNull();
  });

  it("4. rejects an event lacking the fedos-private marker tag (e.g. a privateNostrDelivery()-originated event sharing this same proprietary kind but a different tag shape -- see also test/secure_runtime_alpha_1611_1690_kind1_closure.test.ts for the public-Board-kind-1 case)", () => {
    const descriptor = descriptorFrom([["p", COUNTERPARTY_PUBKEY], ["e-envelope", "envelope-1"]], "");
    expect(parseFedosPrivateTransportEventDescriptor(descriptor)).toBeNull();
  });

  it("5. rejects an event missing the e-envelope tag", () => {
    const descriptor = descriptorFrom([[...FEDOS_PRIVATE_TRANSPORT_MARKER_TAG], ["p", COUNTERPARTY_PUBKEY]], "");
    expect(parseFedosPrivateTransportEventDescriptor(descriptor)).toBeNull();
  });

  it("6. rejects invalid base64 content", () => {
    const descriptor = descriptorFrom(
      [[...FEDOS_PRIVATE_TRANSPORT_MARKER_TAG], ["p", COUNTERPARTY_PUBKEY], ["e-envelope", "envelope-1"]],
      "not!!valid==base64",
    );
    expect(parseFedosPrivateTransportEventDescriptor(descriptor)).toBeNull();
  });
});
