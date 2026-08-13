import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

import { verifyAndBuildInboundCommerceNostrEnvelope } from "../src/os/commerce/catalog/adapters/nostr/commerce_inbound_event_bridge.js";
import {
  NostrProductMediaSyncPort,
  productMediaDeclarationToEventDraft,
  productMediaRetractionToEventDraft,
} from "../src/os/commerce/catalog/adapters/nostr/product_media_sync_bridge.js";
import type { NostrEvent } from "../src/os/messenger/adapters/nostr/protocol/types.js";
import { CommerceNostrProductReadModel } from "../src/os/commerce/events/commerce_nostr_event_read_model.js";
import {
  isWellFormedCommerceNostrEventDraft,
  isWellFormedProductMediaDeclarationEventDraft,
  isWellFormedProductMediaRetractionEventDraft,
  PRODUCT_MEDIA_DECLARATION_EVENT_ALLOWED_KEYS,
  COMMERCE_NOSTR_EVENT_CATEGORIES,
  COMMERCE_NOSTR_EVENT_DRAFT_ALLOWED_KEYS,
  type CommerceNostrEventDraft,
  type ProductPublicationEventDraft,
  type ProductMediaDeclarationEventDraft,
  type ProductMediaRetractionEventDraft,
} from "../src/os/commerce/events/commerce_nostr_event_drafts.js";
import { CommerceNostrEventPortImpl } from "../src/os/commerce/events/commerce_nostr_event_port.js";
import { InMemoryFakeCommerceNostrTransport } from "../src/os/commerce/events/commerce_nostr_fake_transport.js";
import {
  deriveProductMediaDeclaration,
  buildProductMediaRetraction,
} from "../src/os/commerce/catalog/product_media_declaration_types.js";
import type { ProductMedia } from "../src/os/commerce/catalog/product_media_types.js";

/**
 * ProductMedia Sync Protocol (Agent M, Commerce Product-Media Sync +
 * Truthful Completion mega-arc, Wave A) — wire-shape validation, the
 * publish-side Port/adapter, and the full real-signed-event pipeline
 * (real @noble/curves Schnorr signing + real
 * `verifyAndBuildInboundCommerceNostrEnvelope` verification + real
 * `CommerceNostrProductReadModel.ingest()`), mirroring
 * `test/commerce_offline_reconnect_discovery.test.ts`'s own established
 * "same real sync/read-model mechanism Product publication itself uses"
 * proof technique exactly — no fixture injection, no same-process
 * shortcut.
 *
 * NOTE for the Coordinator: this proves the mechanism at the SAME
 * unit-testing level `commerce_offline_reconnect_discovery.test.ts` uses
 * for Product discovery (real signing, real verification, real read model,
 * an in-memory relay stand-in). A full two-Electron-process E2E proof
 * (mirroring `commerce_e2e_two_process_real_electron.test.ts`) is a Wave C
 * item, not attempted here — flagged explicitly per this arc's own mandate.
 */

const BOB_SECRET = new Uint8Array(32).fill(7);
const BOB_PUBKEY = bytesToHex(schnorr.getPublicKey(BOB_SECRET));
const ATTACKER_SECRET = new Uint8Array(32).fill(9);
const ATTACKER_PUBKEY = bytesToHex(schnorr.getPublicKey(ATTACKER_SECRET));

function signCommerceDraftAsRealNostrEvent(draft: CommerceNostrEventDraft, secretKey: Uint8Array, createdAt: number): NostrEvent {
  const pubkey = bytesToHex(schnorr.getPublicKey(secretKey));
  const tags: string[][] = [["t", `fedos-commerce:${draft.category}:v1`]];
  const content = JSON.stringify(draft);
  const preimage = JSON.stringify([0, pubkey, createdAt, 1, tags, content]);
  const id = bytesToHex(sha256(new TextEncoder().encode(preimage)));
  const sig = bytesToHex(schnorr.sign(hexToBytes(id), secretKey));
  return Object.freeze({ id, pubkey, created_at: createdAt, kind: 1, tags, content, sig });
}

function bobsPublication(overrides: Partial<ProductPublicationEventDraft> = {}): ProductPublicationEventDraft {
  return {
    category: "product-publication",
    formatVersion: 1,
    productId: "prod-bob-ebook",
    productKind: "pdf",
    title: "Bob's Real Ebook",
    creatorPubkey: BOB_PUBKEY,
    priceCents: 999,
    currency: "USD",
    status: "active",
    publishedAt: 1_700_000_000,
    ...overrides,
  };
}

function bobsMediaDeclaration(overrides: Partial<ProductMediaDeclarationEventDraft> = {}): ProductMediaDeclarationEventDraft {
  return {
    category: "product-media-declaration",
    formatVersion: 1,
    mediaId: "media-ebook-pdf",
    productId: "prod-bob-ebook",
    sellerPubkey: BOB_PUBKEY,
    role: "primary",
    classification: "protected",
    contentType: "application/pdf",
    sizeClass: "small",
    checksum: "f".repeat(64),
    checksumSubject: "ciphertext",
    version: 1,
    declaredAt: 1_700_000_100,
    ...overrides,
  };
}

function bobsMediaRetraction(overrides: Partial<ProductMediaRetractionEventDraft> = {}): ProductMediaRetractionEventDraft {
  return {
    category: "product-media-retraction",
    formatVersion: 1,
    mediaId: "media-ebook-pdf",
    productId: "prod-bob-ebook",
    sellerPubkey: BOB_PUBKEY,
    version: 2,
    retractedAt: 1_700_000_200,
    ...overrides,
  };
}

/** Mirrors `commerce_offline_reconnect_discovery.test.ts`'s own `InMemoryLoopbackRelay` exactly — a real relay's REQ/EOSE re-delivers every currently-matching event on every query. */
class InMemoryLoopbackRelay {
  readonly #events: NostrEvent[] = [];
  publish(event: NostrEvent): void {
    this.#events.push(event);
  }
  query(): readonly NostrEvent[] {
    return [...this.#events];
  }
}

// ---------------------------------------------------------------------------
// Wire-shape validation
// ---------------------------------------------------------------------------

describe("commerce nostr event drafts: product-media-declaration", () => {
  it("accepts a well-formed declaration", () => {
    expect(isWellFormedProductMediaDeclarationEventDraft(bobsMediaDeclaration())).toBe(true);
    expect(isWellFormedCommerceNostrEventDraft(bobsMediaDeclaration())).toBe(true);
  });

  it("accepts a well-formed public declaration too (classification is not fixed to protected)", () => {
    const draft = bobsMediaDeclaration({ classification: "public", checksumSubject: "plaintext", role: "gallery" });
    expect(isWellFormedProductMediaDeclarationEventDraft(draft)).toBe(true);
  });

  it("REJECTS protected classification paired with checksumSubject plaintext", () => {
    const draft = bobsMediaDeclaration({ classification: "protected", checksumSubject: "plaintext" });
    expect(isWellFormedProductMediaDeclarationEventDraft(draft)).toBe(false);
  });

  it("rejects a non-hex64 sellerPubkey / checksum", () => {
    expect(isWellFormedProductMediaDeclarationEventDraft({ ...bobsMediaDeclaration(), sellerPubkey: "nope" })).toBe(false);
    expect(isWellFormedProductMediaDeclarationEventDraft({ ...bobsMediaDeclaration(), checksum: "nope" })).toBe(false);
  });

  it("rejects version 0 (must be a positive integer)", () => {
    expect(isWellFormedProductMediaDeclarationEventDraft({ ...bobsMediaDeclaration(), version: 0 })).toBe(false);
  });

  it("exposes a non-empty allowlist entry, and the category is enumerated", () => {
    expect(COMMERCE_NOSTR_EVENT_CATEGORIES).toContain("product-media-declaration");
    expect(COMMERCE_NOSTR_EVENT_CATEGORIES).toContain("product-media-retraction");
    expect(COMMERCE_NOSTR_EVENT_DRAFT_ALLOWED_KEYS["product-media-declaration"].size).toBeGreaterThan(0);
    expect(COMMERCE_NOSTR_EVENT_DRAFT_ALLOWED_KEYS["product-media-retraction"].size).toBeGreaterThan(0);
  });

  /**
   * MANDATORY per this arc's own requirement: the forbidden fields must be
   * STRUCTURALLY IMPOSSIBLE to serialize, proven by showing the allowlist
   * validator rejects every one of them as soon as they are smuggled onto
   * an otherwise well-formed draft — not merely "currently absent" from the
   * happy-path fixture above.
   */
  const FORBIDDEN_FIELD_INJECTIONS: ReadonlyArray<Record<string, unknown>> = [
    { decryptionKey: "aabbccdd" },
    { contentKey: "aabbccdd" },
    { aeadKeyHandle: { opaque: true } },
    { mediaAccessGrant: { grantVersion: 1 } },
    { grantSecretPayload: "shh" },
    { buyerPubkey: "b".repeat(64) },
    { buyerRealName: "Alice Example" },
    { orderId: "order-123" },
    { paymentId: "payment-123" },
    { deliveryId: "delivery-123" },
    { masterSeed: "seed-material" },
    { privateKey: "d".repeat(64) },
    { secretKey: "d".repeat(64) },
    { authorizationToken: "token-abc" },
    { storageRef: "ipfs://internal-backend-pointer" },
    { sizeBytes: 12345 }, // exact byte count — sizeClass is the only allowed size field
    { comment: "free text note" },
  ];

  for (const injection of FORBIDDEN_FIELD_INJECTIONS) {
    const fieldName = Object.keys(injection)[0];
    it(`REJECTS a draft carrying a smuggled "${fieldName}" field — structurally impossible, not merely absent`, () => {
      const draft = { ...bobsMediaDeclaration(), ...injection };
      expect(isWellFormedProductMediaDeclarationEventDraft(draft)).toBe(false);
      expect(isWellFormedCommerceNostrEventDraft(draft)).toBe(false);
    });
  }

  it("the allowlist constant itself never names any forbidden field", () => {
    const forbidden = ["decryptionKey", "buyerPubkey", "orderId", "paymentId", "masterSeed", "privateKey", "authorizationToken", "storageRef", "sizeBytes", "comment"];
    for (const name of forbidden) {
      expect(PRODUCT_MEDIA_DECLARATION_EVENT_ALLOWED_KEYS.has(name)).toBe(false);
    }
  });
});

describe("commerce nostr event drafts: product-media-retraction", () => {
  it("accepts a well-formed retraction", () => {
    expect(isWellFormedProductMediaRetractionEventDraft(bobsMediaRetraction())).toBe(true);
    expect(isWellFormedCommerceNostrEventDraft(bobsMediaRetraction())).toBe(true);
  });

  it("rejects an extra/unknown field", () => {
    expect(isWellFormedProductMediaRetractionEventDraft({ ...bobsMediaRetraction(), buyerPubkey: "b".repeat(64) })).toBe(false);
  });

  it("rejects version 0", () => {
    expect(isWellFormedProductMediaRetractionEventDraft({ ...bobsMediaRetraction(), version: 0 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Publish-side Port/adapter
// ---------------------------------------------------------------------------

describe("NostrProductMediaSyncPort", () => {
  const media: ProductMedia = {
    id: "media-ebook-pdf",
    productId: "prod-bob-ebook",
    role: "primary",
    classification: "protected",
    contentType: "application/pdf",
    sizeBytes: 42_000,
    checksum: "f".repeat(64),
    checksumSubject: "ciphertext",
    storageRef: "opaque-internal-ref",
  };

  it("publishes a declaration as a well-formed draft through the EXISTING CommerceNostrEventPort, unmodified", async () => {
    const transport = new InMemoryFakeCommerceNostrTransport();
    const eventPort = new CommerceNostrEventPortImpl(transport, "direct");
    const port = new NostrProductMediaSyncPort(eventPort);

    const declaration = deriveProductMediaDeclaration(media, BOB_PUBKEY, 1, 1_700_000_100);
    const result = await port.publishDeclaration(declaration);
    expect(result.outcome).toBe("published");
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]?.category).toBe("product-media-declaration");
  });

  it("publishing the identical declaration twice is deduplicated by the existing Port, never double-sent", async () => {
    const transport = new InMemoryFakeCommerceNostrTransport();
    const eventPort = new CommerceNostrEventPortImpl(transport, "direct");
    const port = new NostrProductMediaSyncPort(eventPort);
    const declaration = deriveProductMediaDeclaration(media, BOB_PUBKEY, 1, 1_700_000_100);

    const first = await port.publishDeclaration(declaration);
    const second = await port.publishDeclaration(declaration);
    expect(first.outcome).toBe("published");
    expect(second.outcome).toBe("duplicate");
    expect(second.eventId).toBe(first.eventId);
    expect(transport.sent).toHaveLength(1);
  });

  it("publishes a retraction too", async () => {
    const transport = new InMemoryFakeCommerceNostrTransport();
    const eventPort = new CommerceNostrEventPortImpl(transport, "direct");
    const port = new NostrProductMediaSyncPort(eventPort);
    const retraction = buildProductMediaRetraction("prod-bob-ebook", "media-ebook-pdf", BOB_PUBKEY, 2, 1_700_000_200);
    const result = await port.publishRetraction(retraction);
    expect(result.outcome).toBe("published");
    expect(transport.sent[0]?.category).toBe("product-media-retraction");
  });

  it("is refused under a local-only network profile — inherits the existing Port's own gating, no bypass", async () => {
    const transport = new InMemoryFakeCommerceNostrTransport();
    const eventPort = new CommerceNostrEventPortImpl(transport, "local-only");
    const port = new NostrProductMediaSyncPort(eventPort);
    const declaration = deriveProductMediaDeclaration(media, BOB_PUBKEY, 1, 1_700_000_100);
    const result = await port.publishDeclaration(declaration);
    expect(result.outcome).toBe("network-disabled");
    expect(transport.sent).toHaveLength(0);
  });

  it("the mapping functions never emit storageRef/nostrEventId onto the wire draft", () => {
    const declaration = deriveProductMediaDeclaration(media, BOB_PUBKEY, 1, 1);
    const draft = productMediaDeclarationToEventDraft(declaration);
    expect(Object.keys(draft)).not.toContain("storageRef");
    const retraction = buildProductMediaRetraction("prod-bob-ebook", "media-ebook-pdf", BOB_PUBKEY, 1, 1);
    const retractionDraft = productMediaRetractionToEventDraft(retraction);
    expect(isWellFormedProductMediaRetractionEventDraft(retractionDraft)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Full real-signed-event pipeline — the buyer-side read-model ingestion
// proof, mirroring commerce_offline_reconnect_discovery.test.ts exactly.
// ---------------------------------------------------------------------------

describe("Buyer read-model ingestion: ProductMedia declaration materializes through the SAME real sync mechanism Product publication uses", () => {
  it("1. Bob publishes his product, then declares protected media; Alice's independent read model ingests both via real signature verification and sees the real classification", async () => {
    const relay = new InMemoryLoopbackRelay();
    const alicesReadModel = new CommerceNostrProductReadModel();

    relay.publish(signCommerceDraftAsRealNostrEvent(bobsPublication(), BOB_SECRET, 1_700_000_000));
    relay.publish(signCommerceDraftAsRealNostrEvent(bobsMediaDeclaration(), BOB_SECRET, 1_700_000_100));

    for (const candidate of relay.query()) {
      const envelope = await verifyAndBuildInboundCommerceNostrEnvelope(candidate);
      const result = alicesReadModel.ingest(envelope);
      expect(result.outcome).toBe("applied");
    }

    expect(alicesReadModel.listProducts()).toHaveLength(1);
    const media = alicesReadModel.listProductMedia("prod-bob-ebook");
    expect(media).toHaveLength(1);
    expect(media[0]?.classification).toBe("protected");
    expect(media[0]?.mediaId).toBe("media-ebook-pdf");
    expect(alicesReadModel.getProductMedia("media-ebook-pdf")?.contentType).toBe("application/pdf");
    // Alice learned classification+metadata but NOTHING resembling bytes or a key ever appeared in any draft — proven structurally above, re-confirmed here at the read-model view level.
    expect(Object.keys(media[0] as object)).not.toContain("storageRef");
  });

  it("2. a SECOND reconnect re-queries the same relay and re-delivers the same events — the declaration still appears exactly once, never duplicated", async () => {
    const relay = new InMemoryLoopbackRelay();
    const alicesReadModel = new CommerceNostrProductReadModel();
    relay.publish(signCommerceDraftAsRealNostrEvent(bobsPublication(), BOB_SECRET, 1_700_000_000));
    relay.publish(signCommerceDraftAsRealNostrEvent(bobsMediaDeclaration(), BOB_SECRET, 1_700_000_100));

    for (const candidate of relay.query()) {
      alicesReadModel.ingest(await verifyAndBuildInboundCommerceNostrEnvelope(candidate));
    }
    let duplicateSeen = false;
    for (const candidate of relay.query()) {
      const result = alicesReadModel.ingest(await verifyAndBuildInboundCommerceNostrEnvelope(candidate));
      if (result.outcome === "duplicate") duplicateSeen = true;
    }
    expect(duplicateSeen).toBe(true);
    expect(alicesReadModel.listProductMedia("prod-bob-ebook")).toHaveLength(1);
  });

  it("3. media metadata arriving BEFORE any product-publication is rejected (out of order) — mirrors product-update's own discipline", async () => {
    const relay = new InMemoryLoopbackRelay();
    const alicesReadModel = new CommerceNostrProductReadModel();
    // No product-publication published at all this time.
    relay.publish(signCommerceDraftAsRealNostrEvent(bobsMediaDeclaration(), BOB_SECRET, 1_700_000_100));

    const results = [];
    for (const candidate of relay.query()) {
      results.push(alicesReadModel.ingest(await verifyAndBuildInboundCommerceNostrEnvelope(candidate)));
    }
    expect(results[0]?.outcome).toBe("rejected-unknown-product");
    expect(alicesReadModel.listProductMedia("prod-bob-ebook")).toHaveLength(0);
  });

  it("4. WRONG PRODUCT rejected: an attacker's real key genuinely signs a declaration claiming to be Bob (sellerPubkey=Bob) for Bob's real product — real verified signer ≠ claimed sellerPubkey, rejected", async () => {
    const relay = new InMemoryLoopbackRelay();
    const alicesReadModel = new CommerceNostrProductReadModel();
    relay.publish(signCommerceDraftAsRealNostrEvent(bobsPublication(), BOB_SECRET, 1_700_000_000));
    // Attacker signs for real with THEIR OWN key, but the content claims sellerPubkey: Bob.
    relay.publish(signCommerceDraftAsRealNostrEvent(bobsMediaDeclaration({ sellerPubkey: BOB_PUBKEY }), ATTACKER_SECRET, 1_700_000_100));

    const results = [];
    for (const candidate of relay.query()) {
      results.push(alicesReadModel.ingest(await verifyAndBuildInboundCommerceNostrEnvelope(candidate)));
    }
    expect(results[1]?.outcome).toBe("rejected-signer-mismatch");
    expect(alicesReadModel.listProductMedia("prod-bob-ebook")).toHaveLength(0);
  });

  it("5. WRONG PRODUCT rejected (the other direction): attacker genuinely signs AND claims their own pubkey as sellerPubkey, for a product real-owned by Bob", async () => {
    const relay = new InMemoryLoopbackRelay();
    const alicesReadModel = new CommerceNostrProductReadModel();
    relay.publish(signCommerceDraftAsRealNostrEvent(bobsPublication(), BOB_SECRET, 1_700_000_000));
    relay.publish(
      signCommerceDraftAsRealNostrEvent(bobsMediaDeclaration({ sellerPubkey: ATTACKER_PUBKEY }), ATTACKER_SECRET, 1_700_000_100),
    );

    const results = [];
    for (const candidate of relay.query()) {
      results.push(alicesReadModel.ingest(await verifyAndBuildInboundCommerceNostrEnvelope(candidate)));
    }
    expect(results[1]?.outcome).toBe("rejected-product-mismatch");
    expect(alicesReadModel.listProductMedia("prod-bob-ebook")).toHaveLength(0);
  });

  it("6. stale-version-after-newer-version replay is rejected, real signed events", async () => {
    const relay = new InMemoryLoopbackRelay();
    const alicesReadModel = new CommerceNostrProductReadModel();
    relay.publish(signCommerceDraftAsRealNostrEvent(bobsPublication(), BOB_SECRET, 1_700_000_000));
    relay.publish(signCommerceDraftAsRealNostrEvent(bobsMediaDeclaration({ version: 2, contentType: "application/pdf" }), BOB_SECRET, 1_700_000_150));
    relay.publish(signCommerceDraftAsRealNostrEvent(bobsMediaDeclaration({ version: 1, contentType: "application/zip" }), BOB_SECRET, 1_700_000_100));

    const results = [];
    for (const candidate of relay.query()) {
      results.push(alicesReadModel.ingest(await verifyAndBuildInboundCommerceNostrEnvelope(candidate)));
    }
    expect(results[1]?.outcome).toBe("applied");
    expect(results[2]?.outcome).toBe("rejected-stale-version");
    expect(alicesReadModel.getProductMedia("media-ebook-pdf")?.contentType).toBe("application/pdf");
  });

  it("7. UNPUBLISH: a real retraction event marks the media retracted on Alice's independent process", async () => {
    const relay = new InMemoryLoopbackRelay();
    const alicesReadModel = new CommerceNostrProductReadModel();
    relay.publish(signCommerceDraftAsRealNostrEvent(bobsPublication(), BOB_SECRET, 1_700_000_000));
    relay.publish(signCommerceDraftAsRealNostrEvent(bobsMediaDeclaration(), BOB_SECRET, 1_700_000_100));
    relay.publish(signCommerceDraftAsRealNostrEvent(bobsMediaRetraction(), BOB_SECRET, 1_700_000_200));

    for (const candidate of relay.query()) {
      alicesReadModel.ingest(await verifyAndBuildInboundCommerceNostrEnvelope(candidate));
    }
    expect(alicesReadModel.isProductMediaRetracted("media-ebook-pdf")).toBe(true);
  });

  it("8. malformed media metadata (real signature, invalid content) is rejected as unknown-shape, never applied", async () => {
    const relay = new InMemoryLoopbackRelay();
    const alicesReadModel = new CommerceNostrProductReadModel();
    relay.publish(signCommerceDraftAsRealNostrEvent(bobsPublication(), BOB_SECRET, 1_700_000_000));
    const malformed = { ...bobsMediaDeclaration(), classification: "top-secret" } as unknown as CommerceNostrEventDraft;
    relay.publish(signCommerceDraftAsRealNostrEvent(malformed, BOB_SECRET, 1_700_000_100));

    const results = [];
    for (const candidate of relay.query()) {
      results.push(alicesReadModel.ingest(await verifyAndBuildInboundCommerceNostrEnvelope(candidate)));
    }
    expect(results[1]?.outcome).toBe("rejected-unknown-shape");
    expect(alicesReadModel.listProductMedia("prod-bob-ebook")).toHaveLength(0);
  });

  it("9. a tampered event (content mutated after signing) fails real signature verification and is rejected", async () => {
    const relay = new InMemoryLoopbackRelay();
    const alicesReadModel = new CommerceNostrProductReadModel();
    relay.publish(signCommerceDraftAsRealNostrEvent(bobsPublication(), BOB_SECRET, 1_700_000_000));
    const genuine = signCommerceDraftAsRealNostrEvent(bobsMediaDeclaration(), BOB_SECRET, 1_700_000_100);
    // Tamper with content post-signature (id/sig no longer match).
    const tampered: NostrEvent = { ...genuine, content: JSON.stringify(bobsMediaDeclaration({ classification: "public" })) };
    relay.publish(tampered);

    const results = [];
    for (const candidate of relay.query()) {
      results.push(alicesReadModel.ingest(await verifyAndBuildInboundCommerceNostrEnvelope(candidate)));
    }
    expect(results[1]?.outcome).toBe("rejected-unverified-signature");
    expect(alicesReadModel.listProductMedia("prod-bob-ebook")).toHaveLength(0);
  });
});
