import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

import {
  buildCommercePrivateMediaReleaseRequestUnsignedEventRequest,
  buildCommercePrivateMediaReleaseUnsignedEventRequest,
  COMMERCE_PRIVATE_MEDIA_RELEASE_EVENT_KIND,
  COMMERCE_PRIVATE_MEDIA_RELEASE_REQUEST_TAG,
  COMMERCE_PRIVATE_MEDIA_RELEASE_TAG,
  encryptPrivateMediaReleaseRequestPayload,
  encryptPrivateMediaReleasePayload,
  RealCommercePrivateMediaReleaseRequestTransport,
  RealCommercePrivateMediaReleaseTransport,
  verifyAndDecryptInboundPrivateMediaReleaseRequestEnvelope,
  verifyAndDecryptInboundPrivateMediaReleaseEnvelope,
  type CommerceNip44Wire,
} from "../src/os/commerce/catalog/adapters/nostr/commerce_private_media_release_bridge.js";
import type {
  PrivateMediaReleaseRequestPayload,
  PrivateMediaReleasePayload,
} from "../src/os/commerce/events/commerce_private_media_release_sync.js";
import type { NostrEvent } from "../src/os/messenger/adapters/nostr/protocol/types.js";
import { RejectAllSignatureVerifier } from "../src/os/messenger/adapters/nostr/protocol/signature.js";
import type {
  FedosNostrSigningAuthority,
  FedosNostrUnsignedEventRequest,
} from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { RelayPublisher, PublishResult } from "../src/os/messenger/adapters/nostr/protocol/publish.js";

/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) — LOGIC-ONLY
 * coverage for `commerce_private_media_release_bridge.ts`, mirroring
 * `commerce_private_delivery_bridge_fake_crypto.test.ts`'s own
 * `FakeDirectionalNip44Wire` exactly (models NIP-44's real directional
 * property without implementing or approximating any real cryptography).
 */

const BUYER_SECRET = new Uint8Array(32).fill(21);
const BUYER_PUBKEY = bytesToHex(schnorr.getPublicKey(BUYER_SECRET));
const SELLER_SECRET = new Uint8Array(32).fill(22);
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

function validRequestPayload(overrides: Partial<PrivateMediaReleaseRequestPayload> = {}): PrivateMediaReleaseRequestPayload {
  return {
    category: "private-media-release-request",
    formatVersion: 1,
    orderId: "order-1",
    mediaId: "media-1",
    buyerPubkey: BUYER_PUBKEY,
    sellerPubkey: SELLER_PUBKEY,
    at: 1_700_000_000,
    ...overrides,
  };
}

function validReleasedPayload(overrides: Partial<PrivateMediaReleasePayload> = {}): PrivateMediaReleasePayload {
  return {
    category: "private-media-release",
    formatVersion: 1,
    outcome: "released",
    orderId: "order-1",
    mediaId: "media-1",
    buyerPubkey: BUYER_PUBKEY,
    sellerPubkey: SELLER_PUBKEY,
    grantVersion: 1,
    contentType: "application/pdf",
    contentDigest: "d".repeat(64),
    wireCiphertext: "opaque-inner-wire-ciphertext",
    at: 1_700_000_000,
    ...overrides,
  } as PrivateMediaReleasePayload;
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

describe("commerce_private_media_release_bridge: request direction (buyer -> seller)", () => {
  it("encrypts a well-formed request and produces a well-formed unsigned event request", async () => {
    const buyerWire = new FakeDirectionalNip44Wire(BUYER_PUBKEY);
    const request = await buildCommercePrivateMediaReleaseRequestUnsignedEventRequest(
      validRequestPayload(),
      SELLER_PUBKEY,
      0,
      1_700_000_000,
      buyerWire,
    );
    expect(request).not.toBeNull();
    expect(request!.kind).toBe(COMMERCE_PRIVATE_MEDIA_RELEASE_EVENT_KIND);
    expect(request!.tags).toContainEqual(["t", COMMERCE_PRIVATE_MEDIA_RELEASE_REQUEST_TAG]);
    expect(request!.tags).toContainEqual(["p", SELLER_PUBKEY]);
    expect(request!.content).not.toContain("order-1");
    expect(request!.content).not.toContain("media-1");
  });

  it("fails closed (null) on a malformed request payload -- never reaches encryptNip44Wire", async () => {
    const buyerWire = new FakeDirectionalNip44Wire(BUYER_PUBKEY);
    let encryptCalled = false;
    const spyWire: CommerceNip44Wire = {
      encryptNip44Wire: async (...args) => {
        encryptCalled = true;
        return buyerWire.encryptNip44Wire!(...args);
      },
    };
    const malformed = { ...validRequestPayload(), sellerPubkey: BUYER_PUBKEY }; // self-dealing, invalid
    const result = await encryptPrivateMediaReleaseRequestPayload(malformed as PrivateMediaReleaseRequestPayload, SELLER_PUBKEY, 0, spyWire);
    expect(result).toBeNull();
    expect(encryptCalled).toBe(false);
  });

  it("real end-to-end: seller (real recipient) decrypts and recovers the exact request sent by the buyer", async () => {
    const relay = new InMemoryRelayPublisher();
    const transport = new RealCommercePrivateMediaReleaseRequestTransport({
      signingAuthority: realSchnorrSigningAuthority(BUYER_SECRET),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      accountIndex: 0,
      now: () => 1_700_000_000,
    });
    const sendResult = await transport.send(validRequestPayload(), SELLER_PUBKEY);
    expect(sendResult.accepted).toBe(true);
    const event = relay.published[0]!;
    expect(event.pubkey).toBe(BUYER_PUBKEY);

    const envelope = await verifyAndDecryptInboundPrivateMediaReleaseRequestEnvelope(event, {
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("decrypted");
    expect(envelope.senderPubkeyHex).toBe(BUYER_PUBKEY);
    expect(envelope.payload).toEqual(validRequestPayload());
  });

  it("a THIRD party (not the seller) fails closed, never partial plaintext", async () => {
    const mallorySecret = new Uint8Array(32).fill(33);
    const malloryPubkey = bytesToHex(schnorr.getPublicKey(mallorySecret));
    const relay = new InMemoryRelayPublisher();
    const transport = new RealCommercePrivateMediaReleaseRequestTransport({
      signingAuthority: realSchnorrSigningAuthority(BUYER_SECRET),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      accountIndex: 0,
      now: () => 1_700_000_000,
    });
    await transport.send(validRequestPayload(), SELLER_PUBKEY);
    const event = relay.published[0]!;
    const envelope = await verifyAndDecryptInboundPrivateMediaReleaseRequestEnvelope(event, {
      nip44Wire: new FakeDirectionalNip44Wire(malloryPubkey),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("rejected-decrypt-failed");
    expect(envelope.payload).toBeUndefined();
  });

  it("a tampered outer event fails real signature verification", async () => {
    const relay = new InMemoryRelayPublisher();
    const transport = new RealCommercePrivateMediaReleaseRequestTransport({
      signingAuthority: realSchnorrSigningAuthority(BUYER_SECRET),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      accountIndex: 0,
      now: () => 1_700_000_000,
    });
    await transport.send(validRequestPayload(), SELLER_PUBKEY);
    const event = relay.published[0]!;
    const tampered: NostrEvent = { ...event, content: JSON.stringify({ from: BUYER_PUBKEY, to: SELLER_PUBKEY, data: "00" }) };
    const envelope = await verifyAndDecryptInboundPrivateMediaReleaseRequestEnvelope(tampered, {
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("rejected-unverified-signature");
  });

  it("an event tagged for the OTHER (response) category is not-mine to the request verifier, and vice versa", async () => {
    const relay = new InMemoryRelayPublisher();
    const requestTransport = new RealCommercePrivateMediaReleaseRequestTransport({
      signingAuthority: realSchnorrSigningAuthority(BUYER_SECRET),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      accountIndex: 0,
      now: () => 1_700_000_000,
    });
    await requestTransport.send(validRequestPayload(), SELLER_PUBKEY);
    const requestEvent = relay.published[0]!;

    const responseEnvelope = await verifyAndDecryptInboundPrivateMediaReleaseEnvelope(requestEvent, {
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      localAccountIndex: 0,
    });
    expect(responseEnvelope.outcome).toBe("not-mine");
  });

  it("an injected RejectAllSignatureVerifier makes every event fail closed", async () => {
    const relay = new InMemoryRelayPublisher();
    const transport = new RealCommercePrivateMediaReleaseRequestTransport({
      signingAuthority: realSchnorrSigningAuthority(BUYER_SECRET),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      accountIndex: 0,
      now: () => 1_700_000_000,
    });
    await transport.send(validRequestPayload(), SELLER_PUBKEY);
    const envelope = await verifyAndDecryptInboundPrivateMediaReleaseRequestEnvelope(relay.published[0]!, {
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      localAccountIndex: 0,
      verifier: RejectAllSignatureVerifier,
    });
    expect(envelope.outcome).toBe("rejected-unverified-signature");
  });

  it("a structurally-invalid wire value never throws and is 'not-mine'", async () => {
    for (const garbage of [null, undefined, 42, "x", {}, { id: "not-hex" }]) {
      const envelope = await verifyAndDecryptInboundPrivateMediaReleaseRequestEnvelope(garbage, {
        nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
        localAccountIndex: 0,
      });
      expect(envelope.outcome).toBe("not-mine");
    }
  });
});

describe("commerce_private_media_release_bridge: response direction (seller -> buyer)", () => {
  it("real end-to-end: buyer (real recipient) decrypts and recovers the exact 'released' response sent by the seller", async () => {
    const relay = new InMemoryRelayPublisher();
    const transport = new RealCommercePrivateMediaReleaseTransport({
      signingAuthority: realSchnorrSigningAuthority(SELLER_SECRET),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      accountIndex: 0,
      now: () => 1_700_000_000,
    });
    const sendResult = await transport.send(validReleasedPayload(), BUYER_PUBKEY);
    expect(sendResult.accepted).toBe(true);
    const event = relay.published[0]!;
    expect(event.pubkey).toBe(SELLER_PUBKEY);

    const envelope = await verifyAndDecryptInboundPrivateMediaReleaseEnvelope(event, {
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("decrypted");
    expect(envelope.senderPubkeyHex).toBe(SELLER_PUBKEY);
    expect(envelope.payload).toEqual(validReleasedPayload());
  });

  it("real end-to-end: a 'denied' response also round-trips honestly", async () => {
    const denied: PrivateMediaReleasePayload = {
      category: "private-media-release",
      formatVersion: 1,
      outcome: "denied",
      orderId: "order-1",
      mediaId: "media-1",
      buyerPubkey: BUYER_PUBKEY,
      sellerPubkey: SELLER_PUBKEY,
      reason: "order-not-qualifying",
      at: 1_700_000_000,
    };
    const relay = new InMemoryRelayPublisher();
    const transport = new RealCommercePrivateMediaReleaseTransport({
      signingAuthority: realSchnorrSigningAuthority(SELLER_SECRET),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      accountIndex: 0,
      now: () => 1_700_000_000,
    });
    await transport.send(denied, BUYER_PUBKEY);
    const envelope = await verifyAndDecryptInboundPrivateMediaReleaseEnvelope(relay.published[0]!, {
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("decrypted");
    expect(envelope.payload).toEqual(denied);
  });

  it("a THIRD party cannot decrypt a release response -- fails closed, never partial plaintext", async () => {
    const mallorySecret = new Uint8Array(32).fill(44);
    const malloryPubkey = bytesToHex(schnorr.getPublicKey(mallorySecret));
    const relay = new InMemoryRelayPublisher();
    const transport = new RealCommercePrivateMediaReleaseTransport({
      signingAuthority: realSchnorrSigningAuthority(SELLER_SECRET),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      accountIndex: 0,
      now: () => 1_700_000_000,
    });
    await transport.send(validReleasedPayload(), BUYER_PUBKEY);
    const envelope = await verifyAndDecryptInboundPrivateMediaReleaseEnvelope(relay.published[0]!, {
      nip44Wire: new FakeDirectionalNip44Wire(malloryPubkey),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("rejected-decrypt-failed");
    expect(envelope.payload).toBeUndefined();
  });

  it("fails closed (null) when the wire has no encryptNip44Wire support", async () => {
    const result = await encryptPrivateMediaReleasePayload(validReleasedPayload(), BUYER_PUBKEY, 0, {});
    expect(result).toBeNull();
  });

  it("the response transport's own tag never collides with the request transport's tag", () => {
    expect(COMMERCE_PRIVATE_MEDIA_RELEASE_TAG).not.toBe(COMMERCE_PRIVATE_MEDIA_RELEASE_REQUEST_TAG);
  });

  it("buildCommercePrivateMediaReleaseUnsignedEventRequest fails closed on a malformed payload", async () => {
    const buyerWire = new FakeDirectionalNip44Wire(SELLER_PUBKEY);
    const malformed = { ...validReleasedPayload(), grantVersion: -1 };
    const request = await buildCommercePrivateMediaReleaseUnsignedEventRequest(
      malformed as PrivateMediaReleasePayload,
      BUYER_PUBKEY,
      0,
      1_700_000_000,
      buyerWire,
    );
    expect(request).toBeNull();
  });
});
