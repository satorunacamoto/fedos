import { describe, expect, it } from "vitest";
import {
  COMMERCE_NOSTR_EVENT_CATEGORIES,
  COMMERCE_NOSTR_EVENT_DRAFT_ALLOWED_KEYS,
  isWellFormedCommerceNostrEventDraft,
  isWellFormedMediaManifestReferenceEventDraft,
  isWellFormedOrderCommitmentEventDraft,
  isWellFormedProductPublicationEventDraft,
  isWellFormedProductUpdateEventDraft,
  isWellFormedReputationAttestationEventDraft,
  isWellFormedTradeCompletionAttestationEventDraft,
  PRODUCT_PUBLICATION_EVENT_ALLOWED_KEYS,
  PRODUCT_UPDATE_EVENT_ALLOWED_KEYS,
  type CommerceNostrEventDraft,
  type CommerceNostrProductKindMirror,
  type MediaManifestReferenceEventDraft,
  type OrderCommitmentEventDraft,
  type ProductPublicationEventDraft,
  type ProductUpdateEventDraft,
  type ReputationAttestationEventDraft,
  type TradeCompletionAttestationEventDraft,
} from "../src/os/commerce/events/commerce_nostr_event_drafts.js";

const HEX_A = "a".repeat(64);
const HEX_B = "b".repeat(64);
const HEX_C = "c".repeat(64);
const EPOCH_ID = "1".repeat(32);

/** Arc §11's own explicit forbidden-field list ("FIELDS THAT MUST NEVER
 * APPEAR ANYWHERE IN THIS FILE" -- `commerce_nostr_event_drafts.ts`'s own
 * header) -- a raw buyer identity, a raw Order/payment id, exact per-trade
 * payment rail metadata, exact private delivery evidence, or any free-text
 * comment/note field. */
const FORBIDDEN_FIELD_NAMES: readonly string[] = [
  "buyerPubkey",
  "buyerRealName",
  "buyerName",
  "buyerAddress",
  "buyerEmail",
  "buyerPhone",
  "orderId",
  "paymentId",
  "invoiceId",
  "transactionId",
  "paymentMethod",
  "deliveryAddress",
  "deliveryEvidence",
  "comment",
  "note",
  "internalNote",
];

function validProductPublication(
  overrides: Partial<ProductPublicationEventDraft> = {},
): ProductPublicationEventDraft {
  return {
    category: "product-publication",
    formatVersion: 1,
    productId: "prod-1",
    productKind: "pdf",
    title: "A Fine PDF",
    description: "A description",
    creatorPubkey: HEX_A,
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
    orderRefDigestHex: HEX_A,
    buyerPartyDigestHex: HEX_B,
    sellerPubkey: HEX_C,
    status: "committed",
    committedAt: 1_700_000_200,
    ...overrides,
  };
}

function validTradeCompletionEnvelope() {
  return {
    version: 1,
    type: "fedos.commerce.trade-completion.v1",
    issuer: HEX_A,
    issuedAt: 1_700_000_300,
    payload: {
      attestorEpochKeyPublicHex: HEX_A,
      subjectEpochId: EPOCH_ID,
      tradeRefDigestHex: HEX_B,
      category: "digital_good" as const,
      outcome: "completed_as_agreed" as const,
      completedAt: 1_700_000_290,
      formatVersion: 1 as const,
    },
    signatureAlgorithm: "schnorr-secp256k1",
    keyId: HEX_A,
    signature: "d".repeat(128),
  };
}

function validTradeCompletionEvent(
  overrides: Partial<TradeCompletionAttestationEventDraft> = {},
): TradeCompletionAttestationEventDraft {
  return {
    category: "trade-completion-attestation",
    formatVersion: 1,
    envelope: validTradeCompletionEnvelope(),
    ...overrides,
  };
}

function validReputationEnvelope() {
  return {
    version: 1,
    type: "fedos.commerce.reputation-summary.v1",
    issuer: HEX_A,
    issuedAt: 1_700_000_400,
    payload: {
      subjectEpochId: EPOCH_ID,
      subjectEpochKeyPublicHex: HEX_A,
      verifiedTradeCount: 5,
      attestationRefs: ["ref-1", "ref-2"],
      asOf: 1_700_000_390,
      formatVersion: 1 as const,
    },
    signatureAlgorithm: "schnorr-secp256k1",
    keyId: HEX_A,
    signature: "e".repeat(128),
  };
}

function validReputationEvent(
  overrides: Partial<ReputationAttestationEventDraft> = {},
): ReputationAttestationEventDraft {
  return {
    category: "reputation-attestation",
    formatVersion: 1,
    envelope: validReputationEnvelope(),
    ...overrides,
  };
}

function validMediaManifestReference(
  overrides: Partial<MediaManifestReferenceEventDraft> = {},
): MediaManifestReferenceEventDraft {
  return {
    category: "media-manifest-reference",
    formatVersion: 1,
    productId: "prod-1",
    assetId: "asset-1",
    mediaKind: "pdf",
    contentHashHex: HEX_A,
    sizeBytes: 4096,
    ...overrides,
  };
}

describe("commerce nostr event drafts: category enumeration", () => {
  it("has exactly the original six categories the brief scopes, PLUS the two ProductMedia Sync Protocol categories (Agent M, Commerce Product-Media Sync + Truthful Completion mega-arc, Wave A — see docs/commerce/PRODUCTMEDIA-SYNC-PROTOCOL-DESIGN.md)", () => {
    expect([...COMMERCE_NOSTR_EVENT_CATEGORIES].sort()).toEqual(
      [
        "product-publication",
        "product-update",
        "order-commitment",
        "trade-completion-attestation",
        "reputation-attestation",
        "media-manifest-reference",
        "product-media-declaration",
        "product-media-retraction",
      ].sort(),
    );
  });

  it("exposes an allowlist entry for every category", () => {
    for (const category of COMMERCE_NOSTR_EVENT_CATEGORIES) {
      expect(COMMERCE_NOSTR_EVENT_DRAFT_ALLOWED_KEYS[category].size).toBeGreaterThan(0);
    }
  });
});

describe("commerce nostr event drafts: product-publication", () => {
  it("accepts a well-formed public listing", () => {
    expect(isWellFormedProductPublicationEventDraft(validProductPublication())).toBe(true);
    expect(isWellFormedCommerceNostrEventDraft(validProductPublication())).toBe(true);
  });

  it("rejects an unknown/extra field (allowlist enforcement)", () => {
    const draft = { ...validProductPublication(), buyerRealName: "Alice Example" };
    expect(isWellFormedProductPublicationEventDraft(draft)).toBe(false);
  });

  it("rejects a 'draft' status — draft products must never be published", () => {
    const draft = { ...validProductPublication(), status: "draft" };
    expect(isWellFormedProductPublicationEventDraft(draft)).toBe(false);
  });

  it("rejects a non-hex64 creatorPubkey", () => {
    expect(isWellFormedProductPublicationEventDraft({ ...validProductPublication(), creatorPubkey: "nope" })).toBe(
      false,
    );
  });

  it("rejects a negative priceCents", () => {
    expect(isWellFormedProductPublicationEventDraft({ ...validProductPublication(), priceCents: -1 })).toBe(false);
  });

  it("rejects an unrecognized productKind", () => {
    expect(
      isWellFormedProductPublicationEventDraft({ ...validProductPublication(), productKind: "nft" }),
    ).toBe(false);
  });
});

describe("commerce nostr event drafts: product-update", () => {
  it("accepts a well-formed partial update", () => {
    expect(isWellFormedProductUpdateEventDraft(validProductUpdate())).toBe(true);
  });

  it("rejects an update with no changed fields", () => {
    const draft = {
      category: "product-update" as const,
      formatVersion: 1 as const,
      productId: "prod-1",
      updatedAt: 1_700_000_100,
    };
    expect(isWellFormedProductUpdateEventDraft(draft)).toBe(false);
  });

  it("rejects a 'draft' status", () => {
    expect(isWellFormedProductUpdateEventDraft({ ...validProductUpdate(), status: "draft" })).toBe(false);
  });

  it("rejects an unknown/extra field", () => {
    expect(
      isWellFormedProductUpdateEventDraft({ ...validProductUpdate(), internalNote: "restock Tuesday" }),
    ).toBe(false);
  });
});

describe("commerce nostr event drafts: order-commitment (the non-negotiable one)", () => {
  it("accepts a well-formed coarse commitment", () => {
    expect(isWellFormedOrderCommitmentEventDraft(validOrderCommitment())).toBe(true);
    expect(isWellFormedCommerceNostrEventDraft(validOrderCommitment())).toBe(true);
  });

  it("rejects a draft carrying a raw price", () => {
    const draft = { ...validOrderCommitment(), priceCents: 4999 };
    expect(isWellFormedOrderCommitmentEventDraft(draft)).toBe(false);
  });

  it("rejects a draft carrying a raw amount/currency", () => {
    expect(isWellFormedOrderCommitmentEventDraft({ ...validOrderCommitment(), amount: 5, currency: "USD" })).toBe(
      false,
    );
  });

  it("rejects a draft carrying a raw buyerPubkey instead of a coarse digest", () => {
    const draft = { ...validOrderCommitment(), buyerPubkey: HEX_B };
    expect(isWellFormedOrderCommitmentEventDraft(draft)).toBe(false);
  });

  it("rejects a draft carrying exact payment metadata", () => {
    expect(
      isWellFormedOrderCommitmentEventDraft({
        ...validOrderCommitment(),
        paymentMethod: "lightning",
        invoiceId: "lnbc1...",
      }),
    ).toBe(false);
  });

  it("rejects a draft carrying the raw order id", () => {
    expect(isWellFormedOrderCommitmentEventDraft({ ...validOrderCommitment(), orderId: "order-42" })).toBe(false);
  });

  it("rejects a draft carrying a free-text comment", () => {
    expect(
      isWellFormedOrderCommitmentEventDraft({ ...validOrderCommitment(), comment: "buyer was very nice" }),
    ).toBe(false);
  });

  it("rejects a draft carrying a delivery address", () => {
    expect(
      isWellFormedOrderCommitmentEventDraft({ ...validOrderCommitment(), deliveryAddress: "123 Main St" }),
    ).toBe(false);
  });

  it("rejects a non-hex64 orderRefDigestHex/buyerPartyDigestHex (must be a digest, not a short id)", () => {
    expect(isWellFormedOrderCommitmentEventDraft({ ...validOrderCommitment(), orderRefDigestHex: "order-42" })).toBe(
      false,
    );
    expect(
      isWellFormedOrderCommitmentEventDraft({ ...validOrderCommitment(), buyerPartyDigestHex: "short" }),
    ).toBe(false);
  });

  it("rejects an unrecognized status", () => {
    expect(isWellFormedOrderCommitmentEventDraft({ ...validOrderCommitment(), status: "shipped" })).toBe(false);
  });
});

describe("commerce nostr event drafts: trade-completion-attestation", () => {
  it("accepts a well-formed envelope wrapping a well-formed payload", () => {
    expect(isWellFormedTradeCompletionAttestationEventDraft(validTradeCompletionEvent())).toBe(true);
    expect(isWellFormedCommerceNostrEventDraft(validTradeCompletionEvent())).toBe(true);
  });

  it("rejects an envelope whose payload has an injected forbidden field (defense in depth)", () => {
    const envelope = validTradeCompletionEnvelope();
    const tampered = {
      ...envelope,
      payload: { ...envelope.payload, priceCents: 999 } as unknown as typeof envelope.payload,
    };
    expect(
      isWellFormedTradeCompletionAttestationEventDraft({
        category: "trade-completion-attestation",
        formatVersion: 1,
        envelope: tampered,
      }),
    ).toBe(false);
  });

  it("rejects an envelope whose payload carries a raw order id instead of a digest", () => {
    const envelope = validTradeCompletionEnvelope();
    const tampered = {
      ...envelope,
      payload: { ...envelope.payload, rawOrderId: "order-42" } as unknown as typeof envelope.payload,
    };
    expect(
      isWellFormedTradeCompletionAttestationEventDraft({
        category: "trade-completion-attestation",
        formatVersion: 1,
        envelope: tampered,
      }),
    ).toBe(false);
  });

  it("rejects an envelope with an unknown top-level field", () => {
    const draft = { ...validTradeCompletionEvent(), debugFlag: true };
    expect(isWellFormedTradeCompletionAttestationEventDraft(draft)).toBe(false);
  });

  it("rejects a missing signature", () => {
    const envelope = validTradeCompletionEnvelope();
    const { signature: _signature, ...withoutSignature } = envelope;
    expect(
      isWellFormedTradeCompletionAttestationEventDraft({
        category: "trade-completion-attestation",
        formatVersion: 1,
        envelope: withoutSignature as unknown as typeof envelope,
      }),
    ).toBe(false);
  });
});

describe("commerce nostr event drafts: reputation-attestation", () => {
  it("accepts a well-formed envelope wrapping a well-formed payload", () => {
    expect(isWellFormedReputationAttestationEventDraft(validReputationEvent())).toBe(true);
    expect(isWellFormedCommerceNostrEventDraft(validReputationEvent())).toBe(true);
  });

  it("rejects an envelope whose payload has an injected forbidden field", () => {
    const envelope = validReputationEnvelope();
    const tampered = {
      ...envelope,
      payload: { ...envelope.payload, exactAmountCents: 12345 } as unknown as typeof envelope.payload,
    };
    expect(
      isWellFormedReputationAttestationEventDraft({
        category: "reputation-attestation",
        formatVersion: 1,
        envelope: tampered,
      }),
    ).toBe(false);
  });

  it("rejects a negative verifiedTradeCount", () => {
    const envelope = validReputationEnvelope();
    const tampered = {
      ...envelope,
      payload: { ...envelope.payload, verifiedTradeCount: -1 } as unknown as typeof envelope.payload,
    };
    expect(
      isWellFormedReputationAttestationEventDraft({
        category: "reputation-attestation",
        formatVersion: 1,
        envelope: tampered,
      }),
    ).toBe(false);
  });
});

describe("commerce nostr event drafts: media-manifest-reference", () => {
  it("accepts a well-formed content-hash-only reference", () => {
    expect(isWellFormedMediaManifestReferenceEventDraft(validMediaManifestReference())).toBe(true);
    expect(isWellFormedCommerceNostrEventDraft(validMediaManifestReference())).toBe(true);
  });

  it("rejects a draft carrying a raw storage pointer/URL instead of a content hash", () => {
    expect(
      isWellFormedMediaManifestReferenceEventDraft({
        ...validMediaManifestReference(),
        storageRef: "r2://bucket/private/key",
      }),
    ).toBe(false);
  });

  it("rejects a draft carrying inline bytes/base64 content", () => {
    expect(
      isWellFormedMediaManifestReferenceEventDraft({ ...validMediaManifestReference(), bytesBase64: "AAAA" }),
    ).toBe(false);
  });

  it("rejects a non-hex64 contentHashHex", () => {
    expect(
      isWellFormedMediaManifestReferenceEventDraft({ ...validMediaManifestReference(), contentHashHex: "abc" }),
    ).toBe(false);
  });

  it("rejects a negative sizeBytes", () => {
    expect(isWellFormedMediaManifestReferenceEventDraft({ ...validMediaManifestReference(), sizeBytes: -5 })).toBe(
      false,
    );
  });
});

describe("commerce nostr event drafts: top-level dispatcher", () => {
  it("rejects a non-object", () => {
    expect(isWellFormedCommerceNostrEventDraft(null)).toBe(false);
    expect(isWellFormedCommerceNostrEventDraft("hello")).toBe(false);
    expect(isWellFormedCommerceNostrEventDraft(42)).toBe(false);
  });

  it("rejects an unrecognized category", () => {
    expect(isWellFormedCommerceNostrEventDraft({ category: "totally-new-thing", formatVersion: 1 })).toBe(false);
  });

  it("accepts one valid draft per category, rejects a tampered copy of each", () => {
    const valids: CommerceNostrEventDraft[] = [
      validProductPublication(),
      validProductUpdate(),
      validOrderCommitment(),
      validTradeCompletionEvent(),
      validReputationEvent(),
      validMediaManifestReference(),
    ];
    for (const draft of valids) {
      expect(isWellFormedCommerceNostrEventDraft(draft)).toBe(true);
      expect(isWellFormedCommerceNostrEventDraft({ ...draft, extraneousField: "nope" })).toBe(false);
    }
  });
});

/**
 * FedOS "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent N),
 * arc §11 field classification -- the explicit test this arc's brief calls
 * for: "a test asserting the published draft's key set is exactly the
 * allowlist (UNKNOWN public fields: 0)". `hasOnlyAllowedKeys()` (this
 * file's own implementation, exercised indirectly by every `rejects an
 * unknown/extra field` case above) already enforces this at the VALIDATOR
 * level; this block additionally proves it at the CONSTRUCTION level, for
 * the EXACT draft shapes `fedos_electron_beta_main.cts` (the one real
 * production caller) actually builds on a real publish/update/unpublish --
 * so a future accidental field addition at either the drafts-file level or
 * the main.cts call-site level fails a test, not just a runtime check.
 */
describe("commerce nostr event drafts: field classification (arc §11) -- exact allowlist, zero unknown public fields", () => {
  it("a full product-publication draft's own key set is EXACTLY PRODUCT_PUBLICATION_EVENT_ALLOWED_KEYS -- 0 unknown, 0 missing", () => {
    const draft = validProductPublication();
    expect(Object.keys(draft).sort()).toEqual([...PRODUCT_PUBLICATION_EVENT_ALLOWED_KEYS].sort());
  });

  it("the EXACT product-publication draft shape `fedos_electron_beta_main.cts`'s `publishCommerceNostrProductEventNonFatal()` builds on a real publish carries 0 unknown keys and 0 forbidden fields", () => {
    // Mirrors that function's own draft-construction literal verbatim.
    const product = {
      id: "prod-1",
      kind: "pdf",
      title: "A Fine PDF",
      description: "desc",
      creatorPubkey: HEX_A,
      priceCents: 1999,
      currency: "USD",
    };
    const draft = {
      category: "product-publication" as const,
      formatVersion: 1 as const,
      productId: product.id,
      productKind: product.kind as CommerceNostrProductKindMirror,
      title: product.title,
      description: product.description,
      creatorPubkey: product.creatorPubkey,
      priceCents: product.priceCents,
      currency: product.currency,
      status: "active" as const,
      publishedAt: 1_700_000_000,
    };
    expect(isWellFormedProductPublicationEventDraft(draft)).toBe(true);
    expect(Object.keys(draft).sort()).toEqual([...PRODUCT_PUBLICATION_EVENT_ALLOWED_KEYS].sort());
    for (const forbidden of FORBIDDEN_FIELD_NAMES) {
      expect(Object.keys(draft)).not.toContain(forbidden);
    }
  });

  it("the EXACT product-update (unpublish/archive) draft shape `handleCommerceProductPublish()` builds carries 0 unknown keys", () => {
    const draft = {
      category: "product-update" as const,
      formatVersion: 1 as const,
      productId: "prod-1",
      status: "archived" as const,
      updatedAt: 1_700_000_100,
    };
    expect(isWellFormedProductUpdateEventDraft(draft)).toBe(true);
    for (const key of Object.keys(draft)) {
      expect(PRODUCT_UPDATE_EVENT_ALLOWED_KEYS.has(key)).toBe(true);
    }
  });

  it("the EXACT product-update (field-edit sync) draft shape `publishCommerceNostrProductFieldUpdateNonFatal()` builds carries 0 unknown keys", () => {
    const draft = {
      category: "product-update" as const,
      formatVersion: 1 as const,
      productId: "prod-1",
      title: "New Title",
      priceCents: 2599,
      updatedAt: 1_700_000_200,
    };
    expect(isWellFormedProductUpdateEventDraft(draft)).toBe(true);
    for (const key of Object.keys(draft)) {
      expect(PRODUCT_UPDATE_EVENT_ALLOWED_KEYS.has(key)).toBe(true);
    }
    for (const forbidden of FORBIDDEN_FIELD_NAMES) {
      expect(Object.keys(draft)).not.toContain(forbidden);
    }
  });

  it("no category's allowlist EVER contains a forbidden field name (arc §11's own explicit forbidden list)", () => {
    for (const category of COMMERCE_NOSTR_EVENT_CATEGORIES) {
      const allowed = COMMERCE_NOSTR_EVENT_DRAFT_ALLOWED_KEYS[category];
      for (const forbidden of FORBIDDEN_FIELD_NAMES) {
        expect(allowed.has(forbidden)).toBe(false);
      }
    }
  });
});
