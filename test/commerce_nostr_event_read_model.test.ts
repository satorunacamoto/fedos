import { describe, expect, it } from "vitest";
import {
  CommerceNostrProductReadModel,
  type InboundCommerceNostrEnvelope,
} from "../src/os/commerce/events/commerce_nostr_event_read_model.js";
import type {
  OrderCommitmentEventDraft,
  ProductPublicationEventDraft,
  ProductUpdateEventDraft,
} from "../src/os/commerce/events/commerce_nostr_event_drafts.js";

const ALICE = "a".repeat(64);
const MALLORY = "f".repeat(64);
const SELLER = "c".repeat(64);
const BUYER_DIGEST = "b".repeat(64);
const ORDER_DIGEST = "d".repeat(64);

function validProductPublication(
  overrides: Partial<ProductPublicationEventDraft> = {},
): ProductPublicationEventDraft {
  return {
    category: "product-publication",
    formatVersion: 1,
    productId: "prod-1",
    productKind: "pdf",
    title: "A Fine PDF",
    creatorPubkey: ALICE,
    priceCents: 1999,
    currency: "USD",
    status: "active",
    publishedAt: 1_700_000_000,
    ...overrides,
  };
}

function validProductUpdate(overrides: Partial<ProductUpdateEventDraft> = {}): ProductUpdateEventDraft {
  return {
    category: "product-update",
    formatVersion: 1,
    productId: "prod-1",
    priceCents: 2499,
    updatedAt: 1_700_000_100,
    ...overrides,
  };
}

function validOrderCommitment(overrides: Partial<OrderCommitmentEventDraft> = {}): OrderCommitmentEventDraft {
  return {
    category: "order-commitment",
    formatVersion: 1,
    orderRefDigestHex: ORDER_DIGEST,
    buyerPartyDigestHex: BUYER_DIGEST,
    sellerPubkey: SELLER,
    status: "committed",
    committedAt: 1_700_000_200,
    ...overrides,
  };
}

let nextEventId = 0;
function envelope(overrides: Partial<InboundCommerceNostrEnvelope> = {}): InboundCommerceNostrEnvelope {
  nextEventId += 1;
  return {
    eventId: `evt-${nextEventId}`,
    authorPubkeyHex: ALICE,
    signatureVerified: true,
    receivedAt: 1_700_000_000,
    rawContent: validProductPublication(),
    ...overrides,
  };
}

describe("CommerceNostrProductReadModel: publish -> apply", () => {
  it("1. applies a well-formed, verified product-publication and derives a product view", () => {
    const model = new CommerceNostrProductReadModel();
    const result = model.ingest(envelope({ eventId: "evt-1", rawContent: validProductPublication() }));

    expect(result.outcome).toBe("applied");
    const product = model.getProduct("prod-1");
    expect(product?.title).toBe("A Fine PDF");
    expect(product?.priceCents).toBe(1999);
    expect(product?.creatorPubkeyHex).toBe(ALICE);
    expect(model.appliedEventCount).toBe(1);
  });

  it("2. a product-update applied after its publication merges only the provided fields", () => {
    const model = new CommerceNostrProductReadModel();
    model.ingest(envelope({ eventId: "evt-1", rawContent: validProductPublication() }));
    const result = model.ingest(
      envelope({ eventId: "evt-2", authorPubkeyHex: ALICE, rawContent: validProductUpdate({ priceCents: 2499 }) }),
    );

    expect(result.outcome).toBe("applied");
    const product = model.getProduct("prod-1");
    expect(product?.priceCents).toBe(2499);
    expect(product?.title).toBe("A Fine PDF"); // untouched field survives the merge
    expect(product?.lastEventId).toBe("evt-2");
  });
});

describe("CommerceNostrProductReadModel: duplicate / replay is idempotent", () => {
  it("3. ingesting the exact same event id twice is a no-op the second time — state unchanged", () => {
    const model = new CommerceNostrProductReadModel();
    const ev = envelope({ eventId: "evt-1", rawContent: validProductPublication() });

    const first = model.ingest(ev);
    const second = model.ingest(ev);

    expect(first.outcome).toBe("applied");
    expect(second.outcome).toBe("duplicate");
    expect(model.appliedEventCount).toBe(1);
    expect(model.getProduct("prod-1")?.lastEventId).toBe("evt-1");
  });

  it("4. a replayed update event does not double-apply or corrupt the product view", () => {
    const model = new CommerceNostrProductReadModel();
    model.ingest(envelope({ eventId: "evt-1", rawContent: validProductPublication() }));
    const updateEnvelope = envelope({ eventId: "evt-2", rawContent: validProductUpdate({ priceCents: 2499 }) });
    model.ingest(updateEnvelope);

    // Replay the identical update event id again.
    const replay = model.ingest(updateEnvelope);
    expect(replay.outcome).toBe("duplicate");
    expect(model.getProduct("prod-1")?.priceCents).toBe(2499); // unchanged, not corrupted
  });
});

describe("CommerceNostrProductReadModel: tamper / wrong-signer safety gate", () => {
  it("5. rejects an event whose signature was not verified (tampered/forged) — never applied", () => {
    const model = new CommerceNostrProductReadModel();
    const result = model.ingest(
      envelope({ eventId: "evt-1", signatureVerified: false, rawContent: validProductPublication() }),
    );

    expect(result.outcome).toBe("rejected-unverified-signature");
    expect(model.getProduct("prod-1")).toBeUndefined();
    expect(model.appliedEventCount).toBe(0);
  });

  it("6. rejects a product-publication whose claimed creatorPubkey does not match the real verified signer (wrong signer)", () => {
    const model = new CommerceNostrProductReadModel();
    const result = model.ingest(
      envelope({
        eventId: "evt-1",
        authorPubkeyHex: MALLORY, // Mallory really signed this...
        rawContent: validProductPublication({ creatorPubkey: ALICE }), // ...but claims to be Alice
      }),
    );

    expect(result.outcome).toBe("rejected-signer-mismatch");
    expect(model.getProduct("prod-1")).toBeUndefined();
  });

  it("7. rejects a product-update signed by anyone other than the product's established creator", () => {
    const model = new CommerceNostrProductReadModel();
    model.ingest(envelope({ eventId: "evt-1", authorPubkeyHex: ALICE, rawContent: validProductPublication() }));

    const hijack = model.ingest(
      envelope({
        eventId: "evt-2",
        authorPubkeyHex: MALLORY,
        rawContent: validProductUpdate({ priceCents: 1 }),
      }),
    );

    expect(hijack.outcome).toBe("rejected-signer-mismatch");
    expect(model.getProduct("prod-1")?.priceCents).toBe(1999); // unchanged
  });

  it("8. rejects a re-publication of an existing productId from a different signer (hijack attempt)", () => {
    const model = new CommerceNostrProductReadModel();
    model.ingest(envelope({ eventId: "evt-1", authorPubkeyHex: ALICE, rawContent: validProductPublication() }));

    const hijack = model.ingest(
      envelope({
        eventId: "evt-2",
        authorPubkeyHex: MALLORY,
        rawContent: validProductPublication({ creatorPubkey: MALLORY, title: "Stolen listing" }),
      }),
    );

    expect(hijack.outcome).toBe("rejected-signer-mismatch");
    expect(model.getProduct("prod-1")?.title).toBe("A Fine PDF");
  });
});

describe("CommerceNostrProductReadModel: unknown / malformed shape", () => {
  it("9. rejects content that fails the draft validator entirely (garbage object)", () => {
    const model = new CommerceNostrProductReadModel();
    const result = model.ingest(envelope({ eventId: "evt-1", rawContent: { nonsense: true } }));
    expect(result.outcome).toBe("rejected-unknown-shape");
  });

  it("10. rejects undefined rawContent (e.g. the bridge's own JSON.parse failure) without throwing", () => {
    const model = new CommerceNostrProductReadModel();
    expect(() => model.ingest(envelope({ eventId: "evt-1", rawContent: undefined }))).not.toThrow();
    expect(model.ingest(envelope({ eventId: "evt-2", rawContent: undefined })).outcome).toBe(
      "rejected-unknown-shape",
    );
  });

  it("11. rejects a well-formed-looking but unrecognized category string", () => {
    const model = new CommerceNostrProductReadModel();
    const result = model.ingest(
      envelope({ eventId: "evt-1", rawContent: { ...validProductPublication(), category: "totally-new-thing" } }),
    );
    expect(result.outcome).toBe("rejected-unknown-shape");
  });
});

describe("CommerceNostrProductReadModel: out-of-order / old-version updates never regress state", () => {
  it("12. an update with an OLDER timestamp than the currently-applied state is rejected, state unchanged", () => {
    const model = new CommerceNostrProductReadModel();
    model.ingest(envelope({ eventId: "evt-1", rawContent: validProductPublication({ publishedAt: 1000 }) }));
    model.ingest(envelope({ eventId: "evt-2", rawContent: validProductUpdate({ priceCents: 2499, updatedAt: 2000 }) }));

    const stale = model.ingest(
      envelope({ eventId: "evt-3", rawContent: validProductUpdate({ priceCents: 1, updatedAt: 1500 }) }),
    );

    expect(stale.outcome).toBe("rejected-stale-version");
    expect(model.getProduct("prod-1")?.priceCents).toBe(2499); // the newer state survives
  });

  it("13. a product-update arriving before its product-publication is rejected as out-of-order (unknown product)", () => {
    const model = new CommerceNostrProductReadModel();
    const result = model.ingest(envelope({ eventId: "evt-1", rawContent: validProductUpdate() }));
    expect(result.outcome).toBe("rejected-unknown-product");
    expect(model.getProduct("prod-1")).toBeUndefined();
  });

  it("14. customer-offline catch-up: a burst of events delivered in non-chronological order still converges to the latest real state", () => {
    const model = new CommerceNostrProductReadModel();
    const publication = envelope({ eventId: "evt-pub", rawContent: validProductPublication({ publishedAt: 1000 }) });
    const newer = envelope({
      eventId: "evt-newer",
      rawContent: validProductUpdate({ priceCents: 2499, updatedAt: 2000 }),
    });
    const staleLateArrival = envelope({
      eventId: "evt-stale",
      rawContent: validProductUpdate({ priceCents: 1, updatedAt: 1500 }),
    });

    // Delivery order upon "coming back online" is NOT chronological.
    expect(model.ingest(publication).outcome).toBe("applied");
    expect(model.ingest(newer).outcome).toBe("applied");
    expect(model.ingest(staleLateArrival).outcome).toBe("rejected-stale-version");

    expect(model.getProduct("prod-1")?.priceCents).toBe(2499);
  });
});

describe("CommerceNostrProductReadModel: non-product categories (dedup-only)", () => {
  it("15. records an order-commitment event exactly once, deduplicating a replay", () => {
    const model = new CommerceNostrProductReadModel();
    const ev = envelope({ eventId: "evt-order-1", rawContent: validOrderCommitment() });

    expect(model.ingest(ev).outcome).toBe("applied");
    expect(model.ingest(ev).outcome).toBe("duplicate");
    expect(model.otherRecordCount).toBe(1);
  });
});

describe("CommerceNostrProductReadModel: relay/merchant/customer offline resilience", () => {
  it("16. never throws for any input shape, verified or not, well-formed or not", () => {
    const model = new CommerceNostrProductReadModel();
    const inputs: unknown[] = [
      undefined,
      null,
      42,
      "a string",
      [],
      { category: "product-publication" },
      validProductPublication(),
    ];
    for (const rawContent of inputs) {
      expect(() => model.ingest(envelope({ rawContent }))).not.toThrow();
    }
  });

  it("17. an empty read model (relay never reachable / merchant offline forever) is a safe, queryable, empty state", () => {
    const model = new CommerceNostrProductReadModel();
    expect(model.getProduct("prod-1")).toBeUndefined();
    expect(model.appliedEventCount).toBe(0);
    expect(model.otherRecordCount).toBe(0);
  });
});

describe("CommerceNostrProductReadModel: listProducts() (FedOS Real Two-Party Commerce arc, Agent N -- discovery/catalog-merge seam)", () => {
  it("18. an empty read model lists zero products", () => {
    const model = new CommerceNostrProductReadModel();
    expect(model.listProducts()).toEqual([]);
  });

  it("19. lists every currently-applied product, and only the CURRENT (latest) view of each -- not a duplicate per event", () => {
    const model = new CommerceNostrProductReadModel();
    model.ingest(envelope({ eventId: "evt-1", rawContent: validProductPublication({ productId: "prod-1" }) }));
    model.ingest(envelope({ eventId: "evt-2", rawContent: validProductPublication({ productId: "prod-2" }) }));
    model.ingest(
      envelope({
        eventId: "evt-3",
        rawContent: validProductUpdate({ productId: "prod-1", priceCents: 3333, updatedAt: 1_700_000_500 }),
      }),
    );

    const listed = model.listProducts();
    expect(listed).toHaveLength(2);
    expect(listed.find((p) => p.productId === "prod-1")?.priceCents).toBe(3333); // latest, not the original publication's price
    expect(listed.find((p) => p.productId === "prod-2")?.productId).toBe("prod-2");
  });

  it("20. returns a defensive copy -- mutating the returned array never affects the read model's own state", () => {
    const model = new CommerceNostrProductReadModel();
    model.ingest(envelope({ eventId: "evt-1", rawContent: validProductPublication({ productId: "prod-1" }) }));
    const listed = model.listProducts() as unknown as unknown[];
    listed.push({ productId: "injected" });
    expect(model.listProducts()).toHaveLength(1);
  });
});
