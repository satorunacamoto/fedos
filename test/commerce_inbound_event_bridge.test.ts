import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

import { verifyAndBuildInboundCommerceNostrEnvelope } from "../src/os/commerce/catalog/adapters/nostr/commerce_inbound_event_bridge.js";
import { RejectAllSignatureVerifier } from "../src/os/messenger/adapters/nostr/protocol/signature.js";
import type { NostrEvent } from "../src/os/messenger/adapters/nostr/protocol/types.js";
import {
  CommerceNostrEventPortImpl,
  type CommerceNostrEventTransport,
  type CommerceNostrTransportSendResult,
} from "../src/os/commerce/events/commerce_nostr_event_port.js";
import { CommerceNostrProductReadModel } from "../src/os/commerce/events/commerce_nostr_event_read_model.js";
import type { CommerceNostrEventDraft, ProductPublicationEventDraft } from "../src/os/commerce/events/commerce_nostr_event_drafts.js";

/**
 * FedOS Commerce FINAL Closure Mega-Arc (Agent N) — the "LOCAL/FAKE RELAY
 * E2E" proof required by this wave's brief: two independent, in-process
 * "FedOS instances" (a merchant and a customer) exchanging REAL
 * Schnorr-signed Nostr events (`@noble/curves`, mirroring
 * `test/secure_runtime_alpha_1391_1470_direct_delivery_vertical_slice.test.ts`'s
 * own `realSigningAuthority()` pattern) through a plain in-memory array
 * standing in for a relay. ZERO network I/O anywhere in this file — no
 * socket is ever opened, no public relay is ever contacted.
 */

const MERCHANT_SECRET = new Uint8Array(32).fill(1);
const MERCHANT_PUBKEY = bytesToHex(schnorr.getPublicKey(MERCHANT_SECRET));
const MALLORY_SECRET = new Uint8Array(32).fill(3);
const MALLORY_PUBKEY = bytesToHex(schnorr.getPublicKey(MALLORY_SECRET));

/** Signs an arbitrary Commerce Nostr event draft as a real NIP-01 kind-1
 * event under `secretKey`, exactly the same canonical serialization
 * `../src/os/messenger/adapters/nostr/protocol/event.ts`'s own
 * `serializeForId()` uses (`[0, pubkey, created_at, kind, tags, content]`). */
function signCommerceDraftAsRealNostrEvent(
  draft: CommerceNostrEventDraft,
  secretKey: Uint8Array,
  createdAt: number,
): NostrEvent {
  const pubkey = bytesToHex(schnorr.getPublicKey(secretKey));
  const tags: string[][] = [["t", `fedos-commerce:${draft.category}:v1`]];
  const content = JSON.stringify(draft);
  const preimage = JSON.stringify([0, pubkey, createdAt, 1, tags, content]);
  const id = bytesToHex(sha256(new TextEncoder().encode(preimage)));
  const sig = bytesToHex(schnorr.sign(hexToBytes(id), secretKey));
  return Object.freeze({ id, pubkey, created_at: createdAt, kind: 1, tags, content, sig });
}

function validProductPublication(
  overrides: Partial<ProductPublicationEventDraft> = {},
): ProductPublicationEventDraft {
  return {
    category: "product-publication",
    formatVersion: 1,
    productId: "prod-1",
    productKind: "pdf",
    title: "A Fine PDF",
    creatorPubkey: MERCHANT_PUBKEY,
    priceCents: 1999,
    currency: "USD",
    status: "active",
    publishedAt: 1_700_000_000,
    ...overrides,
  };
}

/** A plain in-memory array standing in for "the relay" — both the
 * merchant and customer sides read/write it directly. No network,
 * no socket, no real relay. */
class InMemoryLoopbackRelay {
  readonly #events: NostrEvent[] = [];
  publish(event: NostrEvent): void {
    this.#events.push(event);
  }
  allEvents(): readonly NostrEvent[] {
    return this.#events;
  }
}

describe("commerce_inbound_event_bridge: real signature verification", () => {
  it("1. a genuinely signed event verifies true and round-trips through to the read model as applied", async () => {
    const draft = validProductPublication();
    const event = signCommerceDraftAsRealNostrEvent(draft, MERCHANT_SECRET, 1_700_000_000);

    const envelope = await verifyAndBuildInboundCommerceNostrEnvelope(event);
    expect(envelope.signatureVerified).toBe(true);
    expect(envelope.authorPubkeyHex).toBe(MERCHANT_PUBKEY);
    expect(envelope.rawContent).toEqual(draft);

    const readModel = new CommerceNostrProductReadModel();
    const result = readModel.ingest(envelope);
    expect(result.outcome).toBe("applied");
    expect(readModel.getProduct("prod-1")?.title).toBe("A Fine PDF");
  });

  it("2. a TAMPERED event (content mutated after signing) fails real verification and is rejected downstream", async () => {
    const draft = validProductPublication();
    const event = signCommerceDraftAsRealNostrEvent(draft, MERCHANT_SECRET, 1_700_000_000);
    const tampered: NostrEvent = { ...event, content: JSON.stringify(validProductPublication({ priceCents: 1 })) };

    const envelope = await verifyAndBuildInboundCommerceNostrEnvelope(tampered);
    expect(envelope.signatureVerified).toBe(false);

    const readModel = new CommerceNostrProductReadModel();
    const result = readModel.ingest(envelope);
    expect(result.outcome).toBe("rejected-unverified-signature");
    expect(readModel.getProduct("prod-1")).toBeUndefined();
  });

  it("3. a tampered SIGNATURE (bit-flipped sig, unchanged body) also fails real verification", async () => {
    const draft = validProductPublication();
    const event = signCommerceDraftAsRealNostrEvent(draft, MERCHANT_SECRET, 1_700_000_000);
    const flippedSig = event.sig.slice(0, -1) + (event.sig.endsWith("9") ? "8" : "9");
    const tampered: NostrEvent = { ...event, sig: flippedSig };

    const envelope = await verifyAndBuildInboundCommerceNostrEnvelope(tampered);
    expect(envelope.signatureVerified).toBe(false);
  });

  it('4. WRONG SIGNER: Mallory genuinely signs a draft that CLAIMS to be the merchant\'s product — real sig verifies true, but the read model still rejects it ("rejected-signer-mismatch")', async () => {
    const spoofedDraft = validProductPublication({ creatorPubkey: MERCHANT_PUBKEY, title: "Hijacked listing" });
    const eventSignedByMallory = signCommerceDraftAsRealNostrEvent(spoofedDraft, MALLORY_SECRET, 1_700_000_000);

    const envelope = await verifyAndBuildInboundCommerceNostrEnvelope(eventSignedByMallory);
    // The signature IS genuinely valid — for Mallory's own key.
    expect(envelope.signatureVerified).toBe(true);
    expect(envelope.authorPubkeyHex).toBe(MALLORY_PUBKEY);

    const readModel = new CommerceNostrProductReadModel();
    const result = readModel.ingest(envelope);
    expect(result.outcome).toBe("rejected-signer-mismatch");
    expect(readModel.getProduct("prod-1")).toBeUndefined();
  });

  it("5. UNKNOWN EVENT SHAPE: a structurally-invalid wire value never throws and never verifies", async () => {
    const garbage: unknown[] = [null, undefined, 42, "just a string", {}, { id: "not-hex" }];
    for (const candidate of garbage) {
      const envelope = await verifyAndBuildInboundCommerceNostrEnvelope(candidate);
      expect(envelope.signatureVerified).toBe(false);
      expect(envelope.rawContent).toBeUndefined();
    }
  });

  it("6. an event whose content is not valid JSON never throws — rawContent is undefined, ingest rejects it", async () => {
    const draft = validProductPublication();
    const event = signCommerceDraftAsRealNostrEvent(draft, MERCHANT_SECRET, 1_700_000_000);
    // Re-sign a non-JSON content body so the signature itself still verifies.
    const pubkey = MERCHANT_PUBKEY;
    const tags = event.tags as string[][];
    const badContent = "not json at all {{{";
    const preimage = JSON.stringify([0, pubkey, event.created_at, 1, tags, badContent]);
    const id = bytesToHex(sha256(new TextEncoder().encode(preimage)));
    const sig = bytesToHex(schnorr.sign(hexToBytes(id), MERCHANT_SECRET));
    const nonJsonEvent: NostrEvent = { id, pubkey, created_at: event.created_at, kind: 1, tags, content: badContent, sig };

    const envelope = await verifyAndBuildInboundCommerceNostrEnvelope(nonJsonEvent);
    expect(envelope.signatureVerified).toBe(true); // sig is genuinely valid for this (nonsense) body
    expect(envelope.rawContent).toBeUndefined(); // but content did not parse as JSON

    const readModel = new CommerceNostrProductReadModel();
    expect(readModel.ingest(envelope).outcome).toBe("rejected-unknown-shape");
  });

  it("7. an injected RejectAllSignatureVerifier makes every event fail closed, regardless of a real valid signature", async () => {
    const draft = validProductPublication();
    const event = signCommerceDraftAsRealNostrEvent(draft, MERCHANT_SECRET, 1_700_000_000);
    const envelope = await verifyAndBuildInboundCommerceNostrEnvelope(event, { verifier: RejectAllSignatureVerifier });
    expect(envelope.signatureVerified).toBe(false);
  });
});

describe("Two-instance local/fake-relay end-to-end: publish -> relay -> read model, idempotent, replay-safe", () => {
  it("8. FULL PIPELINE: merchant publishes a real signed Product event through the Port+fake transport; a loopback relay carries it; a second (customer) read model consumes it; duplicate publish is idempotent; replayed ingest does not corrupt state", async () => {
    const relay = new InMemoryLoopbackRelay();

    // Merchant side: CommerceNostrEventPort + a fake transport that
    // ACTUALLY signs with the real Schnorr key and drops the result onto
    // the shared in-memory relay (standing in for a real
    // RealCommerceNostrEventTransport -> RelayPublisher chain, with zero
    // network I/O).
    let createdAtCounter = 1_700_000_000;
    class SigningLoopbackTransport implements CommerceNostrEventTransport {
      send(draft: CommerceNostrEventDraft): Promise<CommerceNostrTransportSendResult> {
        const event = signCommerceDraftAsRealNostrEvent(draft, MERCHANT_SECRET, createdAtCounter++);
        relay.publish(event);
        return Promise.resolve({ accepted: true, eventId: event.id, message: "" });
      }
    }
    const merchantPort = new CommerceNostrEventPortImpl(new SigningLoopbackTransport(), "direct");

    const draft = validProductPublication();
    const first = await merchantPort.publish(draft);
    expect(first.outcome).toBe("published");

    // Duplicate publish attempt (same logical content) — the Port's own
    // dedup guard makes this a true no-op; the relay never sees a second
    // event.
    const second = await merchantPort.publish({ ...draft });
    expect(second.outcome).toBe("duplicate");
    expect(relay.allEvents().length).toBe(1);

    // Customer side: an entirely independent read model instance consumes
    // whatever is on the relay, via the real verifying bridge.
    const customerReadModel = new CommerceNostrProductReadModel();
    for (const event of relay.allEvents()) {
      const envelope = await verifyAndBuildInboundCommerceNostrEnvelope(event);
      const result = customerReadModel.ingest(envelope);
      expect(result.outcome).toBe("applied");
    }
    expect(customerReadModel.getProduct("prod-1")?.title).toBe("A Fine PDF");
    expect(customerReadModel.getProduct("prod-1")?.priceCents).toBe(1999);

    // Replay: the customer's OWN process restarts / re-scans the relay
    // from the start (e.g. after being offline) — re-ingesting the exact
    // same event must not corrupt or double-count anything.
    for (const event of relay.allEvents()) {
      const envelope = await verifyAndBuildInboundCommerceNostrEnvelope(event);
      const result = customerReadModel.ingest(envelope);
      expect(result.outcome).toBe("duplicate");
    }
    expect(customerReadModel.appliedEventCount).toBe(1);
    expect(customerReadModel.getProduct("prod-1")?.priceCents).toBe(1999); // unchanged, not corrupted
  });

  it("9. RELAY UNAVAILABLE: transport rejects every send — Port reports transport-error, never throws, and a later successful publish still works once the relay returns", async () => {
    let relayUp = false;
    class FlakyTransport implements CommerceNostrEventTransport {
      send(draft: CommerceNostrEventDraft): Promise<CommerceNostrTransportSendResult> {
        if (!relayUp) return Promise.resolve({ accepted: false, eventId: "", message: "relay unreachable" });
        const event = signCommerceDraftAsRealNostrEvent(draft, MERCHANT_SECRET, 1_700_000_000);
        return Promise.resolve({ accepted: true, eventId: event.id, message: "" });
      }
    }
    const port = new CommerceNostrEventPortImpl(new FlakyTransport());

    const whileDown = await port.publish(validProductPublication());
    expect(whileDown.outcome).toBe("transport-error");
    expect(port.publishedCount).toBe(0);

    relayUp = true;
    const onceUp = await port.publish(validProductPublication());
    expect(onceUp.outcome).toBe("published");
  });

  it("10. MERCHANT OFFLINE (never publishes): the customer's read model stays a safe, empty, queryable state — never crashes waiting for events that never arrive", () => {
    const customerReadModel = new CommerceNostrProductReadModel();
    expect(customerReadModel.getProduct("prod-1")).toBeUndefined();
    expect(customerReadModel.appliedEventCount).toBe(0);
  });

  it("11. CUSTOMER OFFLINE then reconnects: a burst of real signed events delivered out of chronological order still converges to the true latest state", async () => {
    const relay = new InMemoryLoopbackRelay();
    const publicationEvent = signCommerceDraftAsRealNostrEvent(
      validProductPublication({ publishedAt: 1000 }),
      MERCHANT_SECRET,
      1000,
    );
    const newerUpdateEvent = signCommerceDraftAsRealNostrEvent(
      { category: "product-update", formatVersion: 1, productId: "prod-1", priceCents: 2499, updatedAt: 2000 },
      MERCHANT_SECRET,
      2000,
    );
    const staleLateArrival = signCommerceDraftAsRealNostrEvent(
      { category: "product-update", formatVersion: 1, productId: "prod-1", priceCents: 1, updatedAt: 1500 },
      MERCHANT_SECRET,
      1500,
    );
    relay.publish(publicationEvent);
    relay.publish(newerUpdateEvent);
    relay.publish(staleLateArrival);

    // The customer was offline the whole time; reconnecting delivers the
    // whole backlog in relay-storage order (already non-chronological
    // relative to real-world arrival, since staleLateArrival's own
    // `updatedAt` is older than newerUpdateEvent's even though this loop
    // processes it last).
    const customerReadModel = new CommerceNostrProductReadModel();
    const outcomes: string[] = [];
    for (const event of relay.allEvents()) {
      const envelope = await verifyAndBuildInboundCommerceNostrEnvelope(event);
      outcomes.push(customerReadModel.ingest(envelope).outcome);
    }

    expect(outcomes).toEqual(["applied", "applied", "rejected-stale-version"]);
    expect(customerReadModel.getProduct("prod-1")?.priceCents).toBe(2499);
  });
});
