import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

import {
  buildCommercePrivatePaymentEvidenceUnsignedEventRequest,
  COMMERCE_PRIVATE_PAYMENT_EVIDENCE_EVENT_KIND,
  COMMERCE_PRIVATE_PAYMENT_EVIDENCE_SYNC_TAG,
  encryptPrivatePaymentEvidenceSyncPayload,
  RealCommercePrivatePaymentEvidenceTransport,
  RealPaymentEvidenceTransport,
  verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope,
  type CommerceNip44Wire,
} from "../src/os/commerce/catalog/adapters/nostr/commerce_private_payment_evidence_bridge.js";
import type { PrivatePaymentEvidenceSyncPayload } from "../src/os/commerce/events/commerce_private_payment_evidence_sync.js";
import type { NostrEvent } from "../src/os/messenger/adapters/nostr/protocol/types.js";
import { RejectAllSignatureVerifier } from "../src/os/messenger/adapters/nostr/protocol/signature.js";
import type {
  FedosNostrSigningAuthority,
  FedosNostrUnsignedEventRequest,
} from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { RelayPublisher, PublishResult } from "../src/os/messenger/adapters/nostr/protocol/publish.js";
import type { PaymentEvidence } from "../src/os/commerce/payment/types.js";

/**
 * Commerce Purchase/Payment Completion mega-arc (Agent P) — LOGIC-ONLY
 * coverage for `commerce_private_payment_evidence_bridge.ts`, using the
 * SAME deliberately non-cryptographic `FakeDirectionalNip44Wire` pattern
 * `commerce_private_order_bridge_fake_crypto.test.ts` established (models
 * NIP-44's real two-party directional property WITHOUT implementing any
 * real cryptography; never used to claim confidentiality). Real crypto
 * coverage would live in a real-relay test mirroring
 * `commerce_nostr_real_relay_private_order_sync.test.ts` — skipped in this
 * environment because no compiled `packages/fedos-core-rust/pkg/` WASM
 * artifact is present (pre-existing environment gap, not something this
 * pass introduces).
 */

const SELLER_SECRET = new Uint8Array(32).fill(6);
const SELLER_PUBKEY = bytesToHex(schnorr.getPublicKey(SELLER_SECRET));
const BUYER_SECRET = new Uint8Array(32).fill(7);
const BUYER_PUBKEY = bytesToHex(schnorr.getPublicKey(BUYER_SECRET));
const MALLORY_SECRET = new Uint8Array(32).fill(8);
const MALLORY_PUBKEY = bytesToHex(schnorr.getPublicKey(MALLORY_SECRET));

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

function validPayload(overrides: Partial<PrivatePaymentEvidenceSyncPayload> = {}): PrivatePaymentEvidenceSyncPayload {
  return {
    category: "private-payment-evidence-sync",
    formatVersion: 1,
    paymentId: "payment-1",
    orderId: "order-1",
    productId: "prod-1",
    amountCents: 4200,
    currency: "USD",
    status: "settled",
    verification: { source: "provider_verified", provider: "btcpay", verifiedAt: 1_700_000_000 },
    observedAt: 1_700_000_000,
    reason: "settled via btcpay webhook",
    at: 1_700_000_100,
    ...overrides,
  };
}

function authoritativeEvidence(overrides: Partial<PaymentEvidence> = {}): PaymentEvidence {
  return {
    paymentId: "payment-1",
    productId: "prod-1",
    observedAt: 1_700_000_000,
    status: "settled",
    reason: "settled via btcpay webhook",
    verification: { source: "provider_verified", authoritative: true, provider: "btcpay", verifiedAt: 1_700_000_000 },
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

describe("commerce_private_payment_evidence_bridge: encryptPrivatePaymentEvidenceSyncPayload / buildCommercePrivatePaymentEvidenceUnsignedEventRequest", () => {
  it("encrypts a well-formed payload and produces a well-formed unsigned event request", async () => {
    const wire = new FakeDirectionalNip44Wire(SELLER_PUBKEY);
    const request = await buildCommercePrivatePaymentEvidenceUnsignedEventRequest(validPayload(), BUYER_PUBKEY, 0, 1_700_000_100, wire);
    expect(request).not.toBeNull();
    expect(request!.kind).toBe(COMMERCE_PRIVATE_PAYMENT_EVIDENCE_EVENT_KIND);
    expect(request!.tags).toContainEqual(["t", COMMERCE_PRIVATE_PAYMENT_EVIDENCE_SYNC_TAG]);
    expect(request!.tags).toContainEqual(["p", BUYER_PUBKEY]);
    // The wire content is opaque ciphertext -- never the raw paymentId/amount in cleartext.
    expect(request!.content).not.toContain("payment-1");
    expect(request!.content).not.toContain("4200");
    expect(request!.content).not.toContain("btcpay");
  });

  it("fails closed (null) on a malformed payload -- never reaches encryptNip44Wire at all", async () => {
    const wire = new FakeDirectionalNip44Wire(SELLER_PUBKEY);
    let encryptCalled = false;
    const spyWire: CommerceNip44Wire = {
      encryptNip44Wire: async (...args) => {
        encryptCalled = true;
        return wire.encryptNip44Wire!(...args);
      },
    };
    const malformed = { ...validPayload(), status: "paid" };
    const result = await encryptPrivatePaymentEvidenceSyncPayload(malformed as PrivatePaymentEvidenceSyncPayload, BUYER_PUBKEY, 0, spyWire);
    expect(result).toBeNull();
    expect(encryptCalled).toBe(false);
  });

  it("fails closed (null) when the wire has no encryptNip44Wire support", async () => {
    const result = await encryptPrivatePaymentEvidenceSyncPayload(validPayload(), BUYER_PUBKEY, 0, {});
    expect(result).toBeNull();
  });
});

describe("commerce_private_payment_evidence_bridge: RealCommercePrivatePaymentEvidenceTransport (real signing, real relay-shaped publisher, fake directional crypto)", () => {
  it("sends a genuinely signed, tagged, encrypted event to the relay publisher", async () => {
    const relay = new InMemoryRelayPublisher();
    const transport = new RealCommercePrivatePaymentEvidenceTransport({
      signingAuthority: realSchnorrSigningAuthority(SELLER_SECRET),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      accountIndex: 0,
      now: () => 1_700_000_100,
    });
    const result = await transport.send(validPayload(), BUYER_PUBKEY);
    expect(result.accepted).toBe(true);
    expect(relay.published).toHaveLength(1);
    expect(relay.published[0]!.pubkey).toBe(SELLER_PUBKEY);
  });
});

describe("commerce_private_payment_evidence_bridge: RealPaymentEvidenceTransport (domain-facing Port adapter)", () => {
  it("refuses to send NON-authoritative evidence -- never even builds a wire payload", async () => {
    const relay = new InMemoryRelayPublisher();
    const transport = new RealPaymentEvidenceTransport({
      signingAuthority: realSchnorrSigningAuthority(SELLER_SECRET),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      accountIndex: 0,
      now: () => 1_700_000_100,
    });
    const unverified = authoritativeEvidence({
      verification: { source: "provider_unverified", authoritative: false, provider: "btcpay" },
    });
    const result = await transport.send(unverified, { orderId: "order-1", amountCents: 4200, currency: "USD" }, BUYER_PUBKEY);
    expect(result.accepted).toBe(false);
    expect(relay.published).toHaveLength(0);

    const bareClaim = authoritativeEvidence({ verification: { source: "customer_claim", authoritative: false } });
    const result2 = await transport.send(bareClaim, { orderId: "order-1", amountCents: 4200, currency: "USD" }, BUYER_PUBKEY);
    expect(result2.accepted).toBe(false);
    expect(relay.published).toHaveLength(0);
  });

  it("sends genuinely authoritative evidence end-to-end (real signature, fake directional crypto)", async () => {
    const relay = new InMemoryRelayPublisher();
    const transport = new RealPaymentEvidenceTransport({
      signingAuthority: realSchnorrSigningAuthority(SELLER_SECRET),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      accountIndex: 0,
      now: () => 1_700_000_100,
    });
    const result = await transport.send(authoritativeEvidence(), { orderId: "order-1", amountCents: 4200, currency: "USD" }, BUYER_PUBKEY);
    expect(result.accepted).toBe(true);
    expect(relay.published).toHaveLength(1);
  });
});

describe("commerce_private_payment_evidence_bridge: verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope", () => {
  async function sendFrom(secretKey: Uint8Array, senderPubkeyHex: string, recipientPubkeyHex: string, payload: PrivatePaymentEvidenceSyncPayload): Promise<NostrEvent> {
    const relay = new InMemoryRelayPublisher();
    const transport = new RealCommercePrivatePaymentEvidenceTransport({
      signingAuthority: realSchnorrSigningAuthority(secretKey),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(senderPubkeyHex),
      accountIndex: 0,
      now: () => 1_700_000_100,
    });
    const result = await transport.send(payload, recipientPubkeyHex);
    expect(result.accepted).toBe(true);
    return relay.published[0]!;
  }

  it("1. the real intended recipient (buyer) decrypts and recovers the exact payload from the real seller", async () => {
    const event = await sendFrom(SELLER_SECRET, SELLER_PUBKEY, BUYER_PUBKEY, validPayload());
    const envelope = await verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope(event, {
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("decrypted");
    expect(envelope.senderPubkeyHex).toBe(SELLER_PUBKEY);
    expect(envelope.payload).toEqual(validPayload());
  });

  it("2. a THIRD party (not the intended recipient) fails closed to rejected-decrypt-failed", async () => {
    const event = await sendFrom(SELLER_SECRET, SELLER_PUBKEY, BUYER_PUBKEY, validPayload());
    const envelope = await verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope(event, {
      nip44Wire: new FakeDirectionalNip44Wire(MALLORY_PUBKEY),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("rejected-decrypt-failed");
    expect(envelope.payload).toBeUndefined();
  });

  it("3. a TAMPERED outer event (content mutated after signing) fails real signature verification -- proves tampered evidence is rejected", async () => {
    const event = await sendFrom(SELLER_SECRET, SELLER_PUBKEY, BUYER_PUBKEY, validPayload());
    const tampered: NostrEvent = { ...event, content: JSON.stringify({ from: SELLER_PUBKEY, to: BUYER_PUBKEY, data: "00" }) };
    const envelope = await verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope(tampered, {
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("rejected-unverified-signature");
  });

  it("4. an event without this file's own tag is 'not-mine' -- never even attempts decryption (e.g. confused with an Order-sync event)", async () => {
    const event = await sendFrom(SELLER_SECRET, SELLER_PUBKEY, BUYER_PUBKEY, validPayload());
    const untagged: NostrEvent = { ...event, tags: [["p", BUYER_PUBKEY]] as string[][] };
    const envelope = await verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope(untagged, {
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("not-mine");
  });

  it("5. RELAY-FORGEABLE PAID: an injected RejectAllSignatureVerifier makes every event fail closed regardless of what a relay claims to have relayed", async () => {
    const event = await sendFrom(SELLER_SECRET, SELLER_PUBKEY, BUYER_PUBKEY, validPayload());
    const envelope = await verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope(event, {
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      localAccountIndex: 0,
      verifier: RejectAllSignatureVerifier,
    });
    expect(envelope.outcome).toBe("rejected-unverified-signature");
  });

  it("6. a structurally-invalid wire value never throws and is 'not-mine' -- covers bare Nostr-event-existence with no real content", async () => {
    for (const garbage of [null, undefined, 42, "x", {}, { id: "not-hex" }]) {
      const envelope = await verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope(garbage, {
        nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
        localAccountIndex: 0,
      });
      expect(envelope.outcome).toBe("not-mine");
    }
  });

  it("7. AI/BOT/MALLORY-FORGEABLE: Mallory can genuinely sign+encrypt+send her OWN forged 'settled' claim addressed to the buyer -- decryption/signature succeed (it IS a real message from Mallory), but she is not the real seller", async () => {
    const forged = validPayload({ orderId: "order-1", amountCents: 4200, currency: "USD", status: "settled" });
    const event = await sendFrom(MALLORY_SECRET, MALLORY_PUBKEY, BUYER_PUBKEY, forged);
    const envelope = await verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope(event, {
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      localAccountIndex: 0,
    });
    // The transport layer alone cannot know Mallory isn't the seller --
    // this is exactly why `payment_evidence_port.ts`'s
    // `applyInboundPaymentEvidenceSync()` independently checks
    // `senderPubkeyHex` against the Order's OWN known counterparty before
    // ever touching the ledger (see commerce_payment_evidence_port.test.ts).
    expect(envelope.outcome).toBe("decrypted");
    expect(envelope.senderPubkeyHex).toBe(MALLORY_PUBKEY);
    expect(envelope.senderPubkeyHex).not.toBe(SELLER_PUBKEY);
  });
});
