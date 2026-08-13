import { describe, expect, it } from "vitest";
import {
  deriveProductMediaDeclaration,
  productMediaSizeClassFor,
  validateProductMediaDeclaration,
  validateProductMediaRetraction,
  buildProductMediaRetraction,
  type ProductMediaDeclaration,
} from "../src/os/commerce/catalog/product_media_declaration_types.js";
import {
  ProductMediaSyncReadModel,
  type ProductMediaSyncVerifiedEnvelope,
} from "../src/os/commerce/catalog/product_media_sync_read_model.js";
import type { ProductMedia } from "../src/os/commerce/catalog/product_media_types.js";

/**
 * ProductMedia Sync Protocol (Agent M, Commerce Product-Media Sync +
 * Truthful Completion mega-arc, Wave A) — pure DOMAIN layer tests. No
 * Nostr, no I/O, no clock reads. See the Nostr-wire/full-pipeline sibling
 * suite (`test/product_media_declaration_nostr_sync.test.ts`) for the
 * real-signed-event materialization proof.
 */

const HEX_SELLER = "a".repeat(64);
const HEX_OTHER = "b".repeat(64);
const HEX_ATTACKER = "c".repeat(64);

function validDeclaration(overrides: Partial<ProductMediaDeclaration> = {}): ProductMediaDeclaration {
  return {
    mediaId: "media-1",
    productId: "prod-1",
    sellerPubkey: HEX_SELLER,
    role: "primary",
    classification: "public",
    contentType: "image/png",
    sizeClass: "small",
    checksum: "d".repeat(64),
    checksumSubject: "plaintext",
    version: 1,
    declaredAt: 1_700_000_000,
    ...overrides,
  };
}

describe("productMediaSizeClassFor", () => {
  it("buckets bytes into the documented coarse classes", () => {
    expect(productMediaSizeClassFor(0)).toBe("tiny");
    expect(productMediaSizeClassFor(9_999)).toBe("tiny");
    expect(productMediaSizeClassFor(10_000)).toBe("small");
    expect(productMediaSizeClassFor(99_999)).toBe("small");
    expect(productMediaSizeClassFor(100_000)).toBe("medium");
    expect(productMediaSizeClassFor(999_999)).toBe("medium");
    expect(productMediaSizeClassFor(1_000_000)).toBe("large");
    expect(productMediaSizeClassFor(9_999_999)).toBe("large");
    expect(productMediaSizeClassFor(10_000_000)).toBe("xlarge");
    expect(productMediaSizeClassFor(50_000_000)).toBe("xlarge");
  });

  it("fails closed toward the LEAST informative bucket on invalid input, never leaking precision", () => {
    expect(productMediaSizeClassFor(-1)).toBe("tiny");
    expect(productMediaSizeClassFor(Number.NaN)).toBe("tiny");
    expect(productMediaSizeClassFor(Number.POSITIVE_INFINITY)).toBe("tiny");
  });
});

describe("validateProductMediaDeclaration", () => {
  it("accepts a well-formed public declaration", () => {
    expect(validateProductMediaDeclaration(validDeclaration()).valid).toBe(true);
  });

  it("accepts a well-formed protected declaration with checksumSubject ciphertext", () => {
    const decision = validateProductMediaDeclaration(
      validDeclaration({ classification: "protected", checksumSubject: "ciphertext", role: "sample" }),
    );
    expect(decision.valid).toBe(true);
  });

  it("REJECTS protected classification with checksumSubject plaintext — the core invariant, re-enforced independently", () => {
    const decision = validateProductMediaDeclaration(validDeclaration({ classification: "protected", checksumSubject: "plaintext" }));
    expect(decision.valid).toBe(false);
    expect(decision.reason).toMatch(/ciphertext/);
  });

  it("rejects an unknown role", () => {
    expect(validateProductMediaDeclaration(validDeclaration({ role: "nft" as never })).valid).toBe(false);
  });

  it("rejects an unknown classification", () => {
    expect(validateProductMediaDeclaration(validDeclaration({ classification: "secret" as never })).valid).toBe(false);
  });

  it("rejects an unknown checksumSubject", () => {
    expect(validateProductMediaDeclaration(validDeclaration({ checksumSubject: "hash" as never })).valid).toBe(false);
  });

  it("rejects an unknown sizeClass", () => {
    expect(validateProductMediaDeclaration(validDeclaration({ sizeClass: "huge" as never })).valid).toBe(false);
  });

  it("rejects a non-hex64 sellerPubkey", () => {
    expect(validateProductMediaDeclaration(validDeclaration({ sellerPubkey: "not-a-pubkey" })).valid).toBe(false);
  });

  it("rejects a non-hex64 checksum", () => {
    expect(validateProductMediaDeclaration(validDeclaration({ checksum: "not-a-checksum" })).valid).toBe(false);
  });

  it("rejects version 0 and negative version — version must be a POSITIVE integer", () => {
    expect(validateProductMediaDeclaration(validDeclaration({ version: 0 })).valid).toBe(false);
    expect(validateProductMediaDeclaration(validDeclaration({ version: -1 })).valid).toBe(false);
    expect(validateProductMediaDeclaration(validDeclaration({ version: 1.5 })).valid).toBe(false);
  });

  it("rejects a negative declaredAt", () => {
    expect(validateProductMediaDeclaration(validDeclaration({ declaredAt: -1 })).valid).toBe(false);
  });

  it("rejects a blank mediaId/productId/contentType", () => {
    expect(validateProductMediaDeclaration(validDeclaration({ mediaId: "" })).valid).toBe(false);
    expect(validateProductMediaDeclaration(validDeclaration({ productId: "" })).valid).toBe(false);
    expect(validateProductMediaDeclaration(validDeclaration({ contentType: "" })).valid).toBe(false);
  });

  it("rejects a malformed (non-object) input without throwing", () => {
    expect(validateProductMediaDeclaration(null as never).valid).toBe(false);
    expect(validateProductMediaDeclaration(undefined as never).valid).toBe(false);
    expect(validateProductMediaDeclaration("nope" as never).valid).toBe(false);
  });
});

describe("validateProductMediaRetraction", () => {
  it("accepts a well-formed retraction", () => {
    const retraction = buildProductMediaRetraction("prod-1", "media-1", HEX_SELLER, 2, 1_700_000_100);
    expect(validateProductMediaRetraction(retraction).valid).toBe(true);
  });

  it("rejects version 0 or negative", () => {
    expect(validateProductMediaRetraction(buildProductMediaRetraction("prod-1", "media-1", HEX_SELLER, 0, 1)).valid).toBe(false);
  });

  it("rejects a non-hex64 sellerPubkey", () => {
    expect(
      validateProductMediaRetraction({ mediaId: "m", productId: "p", sellerPubkey: "nope", version: 1, retractedAt: 1 }).valid,
    ).toBe(false);
  });
});

describe("deriveProductMediaDeclaration", () => {
  const media: ProductMedia = {
    id: "media-99",
    productId: "prod-99",
    role: "gallery",
    classification: "protected",
    contentType: "application/pdf",
    sizeBytes: 55_000,
    checksum: "e".repeat(64),
    checksumSubject: "ciphertext",
    altText: "Sample cover",
    storageRef: "ipfs://super-secret-internal-backend-pointer",
    nostrEventId: "some-other-event-id",
  };

  it("maps a real ProductMedia into its public declaration, bucketing sizeBytes into sizeClass", () => {
    const declaration = deriveProductMediaDeclaration(media, HEX_SELLER, 3, 1_700_000_500);
    expect(declaration).toEqual({
      mediaId: "media-99",
      productId: "prod-99",
      sellerPubkey: HEX_SELLER,
      role: "gallery",
      classification: "protected",
      contentType: "application/pdf",
      sizeClass: "small", // 55_000 bytes -> [10_000, 100_000)
      checksum: "e".repeat(64),
      checksumSubject: "ciphertext",
      altText: "Sample cover",
      version: 3,
      declaredAt: 1_700_000_500,
    });
    expect(validateProductMediaDeclaration(declaration).valid).toBe(true);
  });

  it("structurally EXCLUDES storageRef and nostrEventId — the forbidden fields never even survive the derive step", () => {
    const declaration = deriveProductMediaDeclaration(media, HEX_SELLER, 1, 1);
    const keys = Object.keys(declaration).sort();
    expect(keys).not.toContain("storageRef");
    expect(keys).not.toContain("nostrEventId");
    expect(keys.sort()).toEqual(
      ["mediaId", "productId", "sellerPubkey", "role", "classification", "contentType", "sizeClass", "checksum", "checksumSubject", "altText", "version", "declaredAt"].sort(),
    );
  });

  it("omits altText entirely (not even as undefined-valued key) when the source ProductMedia has none", () => {
    const noAlt: ProductMedia = { ...media, altText: undefined };
    const declaration = deriveProductMediaDeclaration(noAlt, HEX_SELLER, 1, 1);
    expect(Object.keys(declaration)).not.toContain("altText");
  });
});

// ---------------------------------------------------------------------------
// ProductMediaSyncReadModel — pure ordering/replay/product-binding.
// ---------------------------------------------------------------------------

function envelope(overrides: Partial<ProductMediaSyncVerifiedEnvelope> = {}): ProductMediaSyncVerifiedEnvelope {
  return { eventId: "evt-1", authorPubkeyHex: HEX_SELLER, signatureVerified: true, receivedAt: 1_700_000_000, ...overrides };
}

describe("ProductMediaSyncReadModel: happy path", () => {
  it("applies a well-formed declaration when signer, seller, and known product creator all agree", () => {
    const model = new ProductMediaSyncReadModel();
    const result = model.ingestDeclaration(envelope(), validDeclaration(), HEX_SELLER);
    expect(result.outcome).toBe("applied");
    const view = model.getView("media-1");
    expect(view?.classification).toBe("public");
    expect(view?.retracted).toBe(false);
    expect(model.listForProduct("prod-1")).toHaveLength(1);
  });
});

describe("ProductMediaSyncReadModel: signature verification", () => {
  it("rejects an unverified signature before any other check", () => {
    const model = new ProductMediaSyncReadModel();
    const result = model.ingestDeclaration(envelope({ signatureVerified: false }), validDeclaration(), HEX_SELLER);
    expect(result.outcome).toBe("rejected-unverified-signature");
    expect(model.getView("media-1")).toBeUndefined();
  });
});

describe("ProductMediaSyncReadModel: malformed input", () => {
  it("rejects malformed media metadata without throwing, mutating nothing", () => {
    const model = new ProductMediaSyncReadModel();
    const result = model.ingestDeclaration(envelope(), { ...validDeclaration(), classification: "not-a-real-classification" }, HEX_SELLER);
    expect(result.outcome).toBe("rejected-malformed");
    expect(model.getView("media-1")).toBeUndefined();
  });

  it("rejects a non-object payload without throwing", () => {
    const model = new ProductMediaSyncReadModel();
    expect(model.ingestDeclaration(envelope(), "not an object", HEX_SELLER).outcome).toBe("rejected-malformed");
    expect(model.ingestDeclaration(envelope(), null, HEX_SELLER).outcome).toBe("rejected-malformed");
    expect(model.ingestRetraction(envelope(), 12345, HEX_SELLER).outcome).toBe("rejected-malformed");
  });
});

describe("ProductMediaSyncReadModel: product binding (wrong Product rejected)", () => {
  it("rejects when the productId is not yet known to the caller (media metadata cannot precede its product)", () => {
    const model = new ProductMediaSyncReadModel();
    const result = model.ingestDeclaration(envelope(), validDeclaration(), undefined);
    expect(result.outcome).toBe("rejected-unknown-product");
  });

  it("rejects when the declared sellerPubkey does not match the product's real, already-established creator — wrong product / wrong seller", () => {
    const model = new ProductMediaSyncReadModel();
    const result = model.ingestDeclaration(
      envelope({ authorPubkeyHex: HEX_ATTACKER }),
      validDeclaration({ sellerPubkey: HEX_ATTACKER }),
      HEX_SELLER, // the REAL product's creator is Bob (HEX_SELLER), not the attacker
    );
    expect(result.outcome).toBe("rejected-product-mismatch");
    expect(model.getView("media-1")).toBeUndefined();
  });

  it("rejects when the real verified signer does not match the declaration's own claimed sellerPubkey (forged claim, genuinely signed by someone else's key)", () => {
    const model = new ProductMediaSyncReadModel();
    // Attacker signs for real with their OWN key, but claims to be selling Bob's product as Bob.
    const result = model.ingestDeclaration(
      envelope({ authorPubkeyHex: HEX_ATTACKER }),
      validDeclaration({ sellerPubkey: HEX_SELLER }),
      HEX_SELLER,
    );
    expect(result.outcome).toBe("rejected-signer-mismatch");
    expect(model.getView("media-1")).toBeUndefined();
  });
});

describe("ProductMediaSyncReadModel: version ordering / replay rejection", () => {
  it("rejects a duplicate publication replay (same event id) as a safe, idempotent no-op", () => {
    const model = new ProductMediaSyncReadModel();
    const first = model.ingestDeclaration(envelope({ eventId: "evt-A" }), validDeclaration(), HEX_SELLER);
    expect(first.outcome).toBe("applied");
    const replay = model.ingestDeclaration(envelope({ eventId: "evt-A" }), validDeclaration(), HEX_SELLER);
    expect(replay.outcome).toBe("duplicate");
    expect(model.appliedEventCount).toBe(1);
  });

  it("applies a strictly newer version, replacing the prior view", () => {
    const model = new ProductMediaSyncReadModel();
    model.ingestDeclaration(envelope({ eventId: "evt-1" }), validDeclaration({ version: 1, contentType: "image/png" }), HEX_SELLER);
    const second = model.ingestDeclaration(
      envelope({ eventId: "evt-2" }),
      validDeclaration({ version: 2, contentType: "image/webp" }),
      HEX_SELLER,
    );
    expect(second.outcome).toBe("applied");
    expect(model.getView("media-1")?.contentType).toBe("image/webp");
  });

  it("REJECTS a stale-after-newer-version replay — an old version arriving after a newer one was already applied, under a DIFFERENT event id", () => {
    const model = new ProductMediaSyncReadModel();
    model.ingestDeclaration(envelope({ eventId: "evt-2" }), validDeclaration({ version: 2 }), HEX_SELLER);
    const stale = model.ingestDeclaration(envelope({ eventId: "evt-1-replayed" }), validDeclaration({ version: 1 }), HEX_SELLER);
    expect(stale.outcome).toBe("rejected-stale-version");
    // state must be unchanged — still version 2's own content, not mutated by the stale replay.
    expect(model.getView("media-1")?.version).toBe(2);
  });

  it("REJECTS a same-version resend under a new event id — safe/idempotent, no double effect", () => {
    const model = new ProductMediaSyncReadModel();
    model.ingestDeclaration(envelope({ eventId: "evt-1" }), validDeclaration({ version: 1 }), HEX_SELLER);
    const resend = model.ingestDeclaration(envelope({ eventId: "evt-1-resend" }), validDeclaration({ version: 1 }), HEX_SELLER);
    expect(resend.outcome).toBe("rejected-stale-version");
  });
});

describe("ProductMediaSyncReadModel: unpublish / retraction", () => {
  it("marks a media id retracted, and the buyer-facing view reflects it", () => {
    const model = new ProductMediaSyncReadModel();
    model.ingestDeclaration(envelope({ eventId: "evt-1" }), validDeclaration({ version: 1 }), HEX_SELLER);
    expect(model.isRetracted("media-1")).toBe(false);

    const retraction = model.ingestRetraction(
      envelope({ eventId: "evt-2" }),
      buildProductMediaRetraction("prod-1", "media-1", HEX_SELLER, 2, 1_700_000_100),
      HEX_SELLER,
    );
    expect(retraction.outcome).toBe("applied");
    expect(model.isRetracted("media-1")).toBe(true);
    expect(model.getView("media-1")?.retracted).toBe(true);
  });

  it("REJECTS a stale declaration replayed AFTER a retraction — the retraction's own version becomes the new watermark", () => {
    const model = new ProductMediaSyncReadModel();
    model.ingestDeclaration(envelope({ eventId: "evt-1" }), validDeclaration({ version: 1 }), HEX_SELLER);
    model.ingestRetraction(
      envelope({ eventId: "evt-2" }),
      buildProductMediaRetraction("prod-1", "media-1", HEX_SELLER, 2, 1_700_000_100),
      HEX_SELLER,
    );
    expect(model.isRetracted("media-1")).toBe(true);

    // A hostile/lagging relay replays the ORIGINAL declaration (version 1) again, under a fresh event id.
    const staleReplay = model.ingestDeclaration(envelope({ eventId: "evt-1-replayed-post-retraction" }), validDeclaration({ version: 1 }), HEX_SELLER);
    expect(staleReplay.outcome).toBe("rejected-stale-version");
    expect(model.isRetracted("media-1")).toBe(true); // still retracted — never resurrected.
  });

  it("a legitimate re-declare at a HIGHER version than the retraction succeeds and un-retracts", () => {
    const model = new ProductMediaSyncReadModel();
    model.ingestDeclaration(envelope({ eventId: "evt-1" }), validDeclaration({ version: 1 }), HEX_SELLER);
    model.ingestRetraction(
      envelope({ eventId: "evt-2" }),
      buildProductMediaRetraction("prod-1", "media-1", HEX_SELLER, 2, 1_700_000_100),
      HEX_SELLER,
    );
    const relist = model.ingestDeclaration(envelope({ eventId: "evt-3" }), validDeclaration({ version: 3 }), HEX_SELLER);
    expect(relist.outcome).toBe("applied");
    expect(model.isRetracted("media-1")).toBe(false);
  });

  it("retraction itself requires product binding, same as a declaration", () => {
    const model = new ProductMediaSyncReadModel();
    const result = model.ingestRetraction(
      envelope({ authorPubkeyHex: HEX_ATTACKER }),
      buildProductMediaRetraction("prod-1", "media-1", HEX_ATTACKER, 1, 1),
      HEX_SELLER,
    );
    expect(result.outcome).toBe("rejected-product-mismatch");
  });

  it("a duplicate retraction event id is a safe no-op", () => {
    const model = new ProductMediaSyncReadModel();
    model.ingestDeclaration(envelope({ eventId: "evt-1" }), validDeclaration({ version: 1 }), HEX_SELLER);
    const r1 = model.ingestRetraction(envelope({ eventId: "evt-2" }), buildProductMediaRetraction("prod-1", "media-1", HEX_SELLER, 2, 1), HEX_SELLER);
    expect(r1.outcome).toBe("applied");
    const r2 = model.ingestRetraction(envelope({ eventId: "evt-2" }), buildProductMediaRetraction("prod-1", "media-1", HEX_SELLER, 2, 1), HEX_SELLER);
    expect(r2.outcome).toBe("duplicate");
  });
});

describe("ProductMediaSyncReadModel: unrelated media ids/products never interfere", () => {
  it("keeps independent watermarks per mediaId, and listForProduct filters correctly across products", () => {
    const model = new ProductMediaSyncReadModel();
    model.ingestDeclaration(envelope({ eventId: "evt-1" }), validDeclaration({ mediaId: "media-A", productId: "prod-1", version: 1 }), HEX_SELLER);
    model.ingestDeclaration(envelope({ eventId: "evt-2" }), validDeclaration({ mediaId: "media-B", productId: "prod-1", version: 1 }), HEX_SELLER);
    model.ingestDeclaration(
      envelope({ eventId: "evt-3", authorPubkeyHex: HEX_OTHER }),
      validDeclaration({ mediaId: "media-C", productId: "prod-2", sellerPubkey: HEX_OTHER, version: 1 }),
      HEX_OTHER,
    );
    expect(model.listForProduct("prod-1")).toHaveLength(2);
    expect(model.listForProduct("prod-2")).toHaveLength(1);
    expect(model.listForProduct("prod-3")).toHaveLength(0);
  });
});
