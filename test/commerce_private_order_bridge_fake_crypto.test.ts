import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

import {
  buildCommercePrivateOrderUnsignedEventRequest,
  COMMERCE_PRIVATE_ORDER_EVENT_KIND,
  COMMERCE_PRIVATE_ORDER_SYNC_TAG,
  encryptPrivateOrderSyncPayload,
  RealCommercePrivateOrderTransport,
  verifyAndDecryptInboundPrivateOrderEnvelope,
  type CommerceNip44Wire,
} from "../src/os/commerce/catalog/adapters/nostr/commerce_private_order_bridge.js";
import type { PrivateOrderSyncPayload } from "../src/os/commerce/events/commerce_private_order_sync.js";
import type { NostrEvent } from "../src/os/messenger/adapters/nostr/protocol/types.js";
import { RejectAllSignatureVerifier } from "../src/os/messenger/adapters/nostr/protocol/signature.js";
import type {
  FedosNostrSigningAuthority,
  FedosNostrUnsignedEventRequest,
} from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { RelayPublisher, PublishResult } from "../src/os/messenger/adapters/nostr/protocol/publish.js";

/**
 * FedOS "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent N,
 * Coordinator-directed pass) — LOGIC-ONLY coverage for
 * `commerce_private_order_bridge.ts`, using a deliberately non-cryptographic
 * `FakeDirectionalNip44Wire` (models NIP-44's real two-party directional
 * property -- encrypted "from A to B" only decrypts for the real intended
 * "from A" pair on B's own side -- WITHOUT implementing or approximating
 * any real cryptography; NEVER used to claim confidentiality). Real crypto
 * coverage lives in `test/commerce_nostr_real_relay_private_order_sync.test.ts`
 * (real WASM NIP-44 + a real local relay, two independent identities).
 * Signing here uses real `@noble/curves` Schnorr directly, same no-WASM
 * precedent as `test/commerce_inbound_event_bridge.test.ts`.
 */

const BUYER_SECRET = new Uint8Array(32).fill(4);
const BUYER_PUBKEY = bytesToHex(schnorr.getPublicKey(BUYER_SECRET));
const SELLER_SECRET = new Uint8Array(32).fill(5);
const SELLER_PUBKEY = bytesToHex(schnorr.getPublicKey(SELLER_SECRET));

class FakeDirectionalNip44Wire implements CommerceNip44Wire {
  constructor(private readonly selfPubkeyHex: string) {}

  async encryptNip44Wire(_accountIndex: number, counterpartyPublicKeyHex: string, plaintext: Uint8Array): Promise<string | null> {
    return JSON.stringify({ from: this.selfPubkeyHex, to: counterpartyPublicKeyHex, data: bytesToHex(plaintext) });
  }

  async decryptNip44Wire(_accountIndex: number, counterpartyPublicKeyHex: string, payload: string): Promise<Uint8Array | null> {
    try {
      const parsed = JSON.parse(payload) as { from?: unknown; to?: unknown; data?: unknown };
      if (parsed.from !== counterpartyPublicKeyHex || parsed.to !== this.selfPubkeyHex) return null; // wrong direction/recipient -- real NIP-44 fails closed the same way
      if (typeof parsed.data !== "string") return null;
      return hexToBytes(parsed.data);
    } catch {
      return null;
    }
  }
}

function validPayload(overrides: Partial<PrivateOrderSyncPayload> = {}): PrivateOrderSyncPayload {
  return {
    category: "private-order-sync",
    formatVersion: 1,
    orderId: "order-1",
    productId: "prod-1",
    buyerPubkey: BUYER_PUBKEY,
    sellerPubkey: SELLER_PUBKEY,
    quantity: 1,
    unitPriceCents: 4200,
    currency: "USD",
    status: "submitted",
    at: 1_700_000_000,
    ...overrides,
  };
}

/** Real Schnorr signing authority double -- mirrors `commerce_inbound_event_bridge.test.ts`'s
 * own `signCommerceDraftAsRealNostrEvent` helper's math exactly, wrapped
 * as a `FedosNostrSigningAuthority` so `RealCommercePrivateOrderTransport`
 * can be exercised as a genuine class, not just its free functions. */
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

describe("commerce_private_order_bridge: encryptPrivateOrderSyncPayload / buildCommercePrivateOrderUnsignedEventRequest", () => {
  it("encrypts a well-formed payload and produces a well-formed unsigned event request", async () => {
    const buyerWire = new FakeDirectionalNip44Wire(BUYER_PUBKEY);
    const request = await buildCommercePrivateOrderUnsignedEventRequest(validPayload(), SELLER_PUBKEY, 0, 1_700_000_000, buyerWire);
    expect(request).not.toBeNull();
    expect(request!.kind).toBe(COMMERCE_PRIVATE_ORDER_EVENT_KIND);
    expect(request!.tags).toContainEqual(["t", COMMERCE_PRIVATE_ORDER_SYNC_TAG]);
    expect(request!.tags).toContainEqual(["p", SELLER_PUBKEY]);
    // The wire content is opaque ciphertext -- never the raw order id/price in cleartext.
    expect(request!.content).not.toContain("order-1");
    expect(request!.content).not.toContain("4200");
  });

  it("fails closed (null) on a malformed payload -- never reaches encryptNip44Wire at all", async () => {
    const buyerWire = new FakeDirectionalNip44Wire(BUYER_PUBKEY);
    let encryptCalled = false;
    const spyWire: CommerceNip44Wire = {
      encryptNip44Wire: async (...args) => {
        encryptCalled = true;
        return buyerWire.encryptNip44Wire!(...args);
      },
    };
    const malformed = { ...validPayload(), status: "paid" };
    const result = await encryptPrivateOrderSyncPayload(malformed as PrivateOrderSyncPayload, SELLER_PUBKEY, 0, spyWire);
    expect(result).toBeNull();
    expect(encryptCalled).toBe(false);
  });

  it("fails closed (null) when the wire has no encryptNip44Wire support", async () => {
    const result = await encryptPrivateOrderSyncPayload(validPayload(), SELLER_PUBKEY, 0, {});
    expect(result).toBeNull();
  });
});

describe("commerce_private_order_bridge: RealCommercePrivateOrderTransport (real signing, real relay-shaped publisher, fake directional crypto)", () => {
  it("sends a genuinely signed, tagged, encrypted event to the relay publisher", async () => {
    const relay = new InMemoryRelayPublisher();
    const transport = new RealCommercePrivateOrderTransport({
      signingAuthority: realSchnorrSigningAuthority(BUYER_SECRET),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      accountIndex: 0,
      now: () => 1_700_000_000,
    });
    const result = await transport.send(validPayload(), SELLER_PUBKEY);
    expect(result.accepted).toBe(true);
    expect(relay.published).toHaveLength(1);
    expect(relay.published[0]!.pubkey).toBe(BUYER_PUBKEY);
  });
});

describe("commerce_private_order_bridge: verifyAndDecryptInboundPrivateOrderEnvelope", () => {
  async function sendFrom(secretKey: Uint8Array, senderPubkeyHex: string, recipientPubkeyHex: string, payload: PrivateOrderSyncPayload): Promise<NostrEvent> {
    const relay = new InMemoryRelayPublisher();
    const transport = new RealCommercePrivateOrderTransport({
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

  it("1. the real intended recipient decrypts and recovers the exact payload", async () => {
    const event = await sendFrom(BUYER_SECRET, BUYER_PUBKEY, SELLER_PUBKEY, validPayload());
    const envelope = await verifyAndDecryptInboundPrivateOrderEnvelope(event, {
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("decrypted");
    expect(envelope.senderPubkeyHex).toBe(BUYER_PUBKEY);
    expect(envelope.payload).toEqual(validPayload());
  });

  it("2. a THIRD party (not the intended recipient) fails closed to rejected-decrypt-failed, never partial plaintext", async () => {
    const mallorySecret = new Uint8Array(32).fill(9);
    const malloryPubkey = bytesToHex(schnorr.getPublicKey(mallorySecret));
    const event = await sendFrom(BUYER_SECRET, BUYER_PUBKEY, SELLER_PUBKEY, validPayload());
    const envelope = await verifyAndDecryptInboundPrivateOrderEnvelope(event, {
      nip44Wire: new FakeDirectionalNip44Wire(malloryPubkey),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("rejected-decrypt-failed");
    expect(envelope.payload).toBeUndefined();
  });

  it("3. a TAMPERED outer event (content mutated after signing) fails real signature verification", async () => {
    const event = await sendFrom(BUYER_SECRET, BUYER_PUBKEY, SELLER_PUBKEY, validPayload());
    const tampered: NostrEvent = { ...event, content: JSON.stringify({ from: BUYER_PUBKEY, to: SELLER_PUBKEY, data: "00" }) };
    const envelope = await verifyAndDecryptInboundPrivateOrderEnvelope(tampered, {
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("rejected-unverified-signature");
  });

  it("4. an event without this file's own tag is 'not-mine' -- never even attempts decryption", async () => {
    const event = await sendFrom(BUYER_SECRET, BUYER_PUBKEY, SELLER_PUBKEY, validPayload());
    const untagged: NostrEvent = { ...event, tags: [["p", SELLER_PUBKEY]] as string[][], id: event.id };
    // Re-verify against the (now-mismatched) id is irrelevant -- "not-mine" short-circuits before signature verification.
    const envelope = await verifyAndDecryptInboundPrivateOrderEnvelope(untagged, {
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("not-mine");
  });

  it("5. an injected RejectAllSignatureVerifier makes every event fail closed regardless of real validity", async () => {
    const event = await sendFrom(BUYER_SECRET, BUYER_PUBKEY, SELLER_PUBKEY, validPayload());
    const envelope = await verifyAndDecryptInboundPrivateOrderEnvelope(event, {
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      localAccountIndex: 0,
      verifier: RejectAllSignatureVerifier,
    });
    expect(envelope.outcome).toBe("rejected-unverified-signature");
  });

  it("6. a structurally-invalid wire value never throws and is 'not-mine'", async () => {
    for (const garbage of [null, undefined, 42, "x", {}, { id: "not-hex" }]) {
      const envelope = await verifyAndDecryptInboundPrivateOrderEnvelope(garbage, {
        nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
        localAccountIndex: 0,
      });
      expect(envelope.outcome).toBe("not-mine");
    }
  });
});
