import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

import {
  buildCommercePrivateDeliveryUnsignedEventRequest,
  COMMERCE_PRIVATE_DELIVERY_EVENT_KIND,
  COMMERCE_PRIVATE_DELIVERY_SYNC_TAG,
  encryptPrivateDeliverySyncPayload,
  RealCommercePrivateDeliveryTransport,
  verifyAndDecryptInboundPrivateDeliveryEnvelope,
  type CommerceNip44Wire,
} from "../src/os/commerce/catalog/adapters/nostr/commerce_private_delivery_bridge.js";
import type { PrivateDeliverySyncPayload } from "../src/os/commerce/events/commerce_private_delivery_sync.js";
import type { NostrEvent } from "../src/os/messenger/adapters/nostr/protocol/types.js";
import { RejectAllSignatureVerifier } from "../src/os/messenger/adapters/nostr/protocol/signature.js";
import type {
  FedosNostrSigningAuthority,
  FedosNostrUnsignedEventRequest,
} from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { RelayPublisher, PublishResult } from "../src/os/messenger/adapters/nostr/protocol/publish.js";

/**
 * FedOS Commerce Purchase Completion mega-arc (Agent D) — LOGIC-ONLY
 * coverage for `commerce_private_delivery_bridge.ts`, mirroring
 * `commerce_private_order_bridge_fake_crypto.test.ts`'s own
 * `FakeDirectionalNip44Wire` exactly (models NIP-44's real directional
 * property without implementing or approximating any real cryptography).
 * Real signing here uses actual `@noble/curves` Schnorr directly, same
 * no-WASM precedent the order-sync bridge test already established. This
 * is this arc's "delivery send/receive" required-test coverage at the
 * wire/transport layer; `commerce_private_delivery_apply.test.ts` covers
 * the same requirement at the domain-reconciliation layer (including
 * replay and wrong-buyer-acknowledgment rejection).
 */

const BUYER_SECRET = new Uint8Array(32).fill(6);
const BUYER_PUBKEY = bytesToHex(schnorr.getPublicKey(BUYER_SECRET));
const SELLER_SECRET = new Uint8Array(32).fill(7);
const SELLER_PUBKEY = bytesToHex(schnorr.getPublicKey(SELLER_SECRET));

class FakeDirectionalNip44Wire implements CommerceNip44Wire {
  constructor(private readonly selfPubkeyHex: string) {}

  async encryptNip44Wire(_accountIndex: number, counterpartyPublicKeyHex: string, plaintext: Uint8Array): Promise<string | null> {
    return JSON.stringify({ from: this.selfPubkeyHex, to: counterpartyPublicKeyHex, data: bytesToHex(plaintext) });
  }

  async decryptNip44Wire(_accountIndex: number, counterpartyPublicKeyHex: string, payload: string): Promise<Uint8Array | null> {
    try {
      const parsed = JSON.parse(payload) as { from?: unknown; to?: unknown; data?: unknown };
      if (parsed.from !== counterpartyPublicKeyHex || parsed.to !== this.selfPubkeyHex) return null;
      if (typeof parsed.data !== "string") return null;
      return hexToBytes(parsed.data);
    } catch {
      return null;
    }
  }
}

function validPayload(overrides: Partial<PrivateDeliverySyncPayload> = {}): PrivateDeliverySyncPayload {
  return {
    category: "private-delivery-sync",
    formatVersion: 1,
    deliveryId: "delivery-1",
    orderId: "order-1",
    buyerPubkey: BUYER_PUBKEY,
    sellerPubkey: SELLER_PUBKEY,
    action: "fulfilling",
    at: 1_700_000_000,
    ...overrides,
  };
}

function realSchnorrSigningAuthority(secretKey: Uint8Array): FedosNostrSigningAuthority {
  return {
    async signEvent(request: FedosNostrUnsignedEventRequest): Promise<NostrEvent | null> {
      const pubkey = bytesToHex(schnorr.getPublicKey(secretKey));
      const preimage = JSON.stringify([0, pubkey, request.createdAt, request.kind, request.tags, request.content]);
      const id = bytesToHex(sha256(new TextEncoder().encode(preimage)));
      const sig = bytesToHex(schnorr.sign(hexToBytes(id), secretKey));
      return { id, pubkey, created_at: request.createdAt, kind: request.kind, tags: request.tags as string[][], content: request.content, sig };
    },
    async publicIdentityForAccount(accountIndex: number) {
      return { accountIndex, publicKeyHex: bytesToHex(schnorr.getPublicKey(secretKey)) };
    },
  };
}

class InMemoryRelayPublisher implements RelayPublisher {
  readonly published: NostrEvent[] = [];
  async publish(event: NostrEvent): Promise<PublishResult> {
    this.published.push(event);
    return { eventId: event.id, accepted: true, message: "" };
  }
}

describe("commerce_private_delivery_bridge: encryptPrivateDeliverySyncPayload / buildCommercePrivateDeliveryUnsignedEventRequest", () => {
  it("encrypts a well-formed payload and produces a well-formed unsigned event request", async () => {
    const sellerWire = new FakeDirectionalNip44Wire(SELLER_PUBKEY);
    const request = await buildCommercePrivateDeliveryUnsignedEventRequest(validPayload(), BUYER_PUBKEY, 0, 1_700_000_000, sellerWire);
    expect(request).not.toBeNull();
    expect(request!.kind).toBe(COMMERCE_PRIVATE_DELIVERY_EVENT_KIND);
    expect(request!.tags).toContainEqual(["t", COMMERCE_PRIVATE_DELIVERY_SYNC_TAG]);
    expect(request!.tags).toContainEqual(["p", BUYER_PUBKEY]);
    expect(request!.content).not.toContain("delivery-1");
    expect(request!.content).not.toContain("order-1");
  });

  it("fails closed (null) on a malformed payload -- never reaches encryptNip44Wire at all", async () => {
    const sellerWire = new FakeDirectionalNip44Wire(SELLER_PUBKEY);
    let encryptCalled = false;
    const spyWire: CommerceNip44Wire = {
      encryptNip44Wire: async (...args) => {
        encryptCalled = true;
        return sellerWire.encryptNip44Wire!(...args);
      },
    };
    const malformed = { ...validPayload(), action: "delivered" };
    const result = await encryptPrivateDeliverySyncPayload(malformed as PrivateDeliverySyncPayload, BUYER_PUBKEY, 0, spyWire);
    expect(result).toBeNull();
    expect(encryptCalled).toBe(false);
  });

  it("fails closed (null) when the wire has no encryptNip44Wire support", async () => {
    const result = await encryptPrivateDeliverySyncPayload(validPayload(), BUYER_PUBKEY, 0, {});
    expect(result).toBeNull();
  });
});

describe("commerce_private_delivery_bridge: RealCommercePrivateDeliveryTransport (real signing, real relay-shaped publisher, fake directional crypto)", () => {
  it("sends a genuinely signed, tagged, encrypted event to the relay publisher -- Bob (seller) -> Alice (buyer)", async () => {
    const relay = new InMemoryRelayPublisher();
    const transport = new RealCommercePrivateDeliveryTransport({
      signingAuthority: realSchnorrSigningAuthority(SELLER_SECRET),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      accountIndex: 0,
      now: () => 1_700_000_000,
    });
    const result = await transport.send(validPayload(), BUYER_PUBKEY);
    expect(result.accepted).toBe(true);
    expect(relay.published).toHaveLength(1);
    expect(relay.published[0]!.pubkey).toBe(SELLER_PUBKEY);
  });
});

describe("commerce_private_delivery_bridge: verifyAndDecryptInboundPrivateDeliveryEnvelope", () => {
  async function sendFrom(
    secretKey: Uint8Array,
    senderPubkeyHex: string,
    recipientPubkeyHex: string,
    payload: PrivateDeliverySyncPayload,
  ): Promise<NostrEvent> {
    const relay = new InMemoryRelayPublisher();
    const transport = new RealCommercePrivateDeliveryTransport({
      signingAuthority: realSchnorrSigningAuthority(secretKey),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(senderPubkeyHex),
      accountIndex: 0,
      now: () => 1_700_000_000,
    });
    const result = await transport.send(payload, recipientPubkeyHex);
    expect(result.accepted).toBe(true);
    return relay.published[0]!;
  }

  it("1. the real intended recipient (Alice, buyer) decrypts and recovers the exact 'fulfilling' payload sent by Bob (seller)", async () => {
    const event = await sendFrom(SELLER_SECRET, SELLER_PUBKEY, BUYER_PUBKEY, validPayload());
    const envelope = await verifyAndDecryptInboundPrivateDeliveryEnvelope(event, {
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("decrypted");
    expect(envelope.senderPubkeyHex).toBe(SELLER_PUBKEY);
    expect(envelope.payload).toEqual(validPayload());
  });

  it("1b. the real intended recipient (Bob, seller) decrypts Alice's 'recipient_acknowledged' payload, with her real verified sender identity intact", async () => {
    const ackPayload = validPayload({ action: "recipient_acknowledged", reason: "got it, thanks" });
    const event = await sendFrom(BUYER_SECRET, BUYER_PUBKEY, SELLER_PUBKEY, ackPayload);
    const envelope = await verifyAndDecryptInboundPrivateDeliveryEnvelope(event, {
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("decrypted");
    expect(envelope.senderPubkeyHex).toBe(BUYER_PUBKEY);
    expect(envelope.payload).toEqual(ackPayload);
  });

  it("2. a THIRD party (not the intended recipient) fails closed to rejected-decrypt-failed, never partial plaintext", async () => {
    const mallorySecret = new Uint8Array(32).fill(11);
    const malloryPubkey = bytesToHex(schnorr.getPublicKey(mallorySecret));
    const event = await sendFrom(SELLER_SECRET, SELLER_PUBKEY, BUYER_PUBKEY, validPayload());
    const envelope = await verifyAndDecryptInboundPrivateDeliveryEnvelope(event, {
      nip44Wire: new FakeDirectionalNip44Wire(malloryPubkey),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("rejected-decrypt-failed");
    expect(envelope.payload).toBeUndefined();
  });

  it("3. a TAMPERED outer event (content mutated after signing) fails real signature verification", async () => {
    const event = await sendFrom(SELLER_SECRET, SELLER_PUBKEY, BUYER_PUBKEY, validPayload());
    const tampered: NostrEvent = { ...event, content: JSON.stringify({ from: SELLER_PUBKEY, to: BUYER_PUBKEY, data: "00" }) };
    const envelope = await verifyAndDecryptInboundPrivateDeliveryEnvelope(tampered, {
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("rejected-unverified-signature");
  });

  it("4. an event without this file's own tag is 'not-mine' -- never even attempts decryption, never confused with a private-order-sync event", async () => {
    const event = await sendFrom(SELLER_SECRET, SELLER_PUBKEY, BUYER_PUBKEY, validPayload());
    const untagged: NostrEvent = { ...event, tags: [["p", BUYER_PUBKEY]] as string[][] };
    const envelope = await verifyAndDecryptInboundPrivateDeliveryEnvelope(untagged, {
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("not-mine");
  });

  it("5. an injected RejectAllSignatureVerifier makes every event fail closed regardless of real validity", async () => {
    const event = await sendFrom(SELLER_SECRET, SELLER_PUBKEY, BUYER_PUBKEY, validPayload());
    const envelope = await verifyAndDecryptInboundPrivateDeliveryEnvelope(event, {
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      localAccountIndex: 0,
      verifier: RejectAllSignatureVerifier,
    });
    expect(envelope.outcome).toBe("rejected-unverified-signature");
  });

  it("6. a structurally-invalid wire value never throws and is 'not-mine'", async () => {
    for (const garbage of [null, undefined, 42, "x", {}, { id: "not-hex" }]) {
      const envelope = await verifyAndDecryptInboundPrivateDeliveryEnvelope(garbage, {
        nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
        localAccountIndex: 0,
      });
      expect(envelope.outcome).toBe("not-mine");
    }
  });
});
