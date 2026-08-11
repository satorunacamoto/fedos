import { describe, it, expect } from "vitest";
import { LocalProductRepository } from "../src/os/commerce/catalog/local_product_repository.js";
import { LocalProductMediaRepository } from "../src/os/commerce/catalog/local_product_media_repository.js";
import { LocalMediaStore } from "../src/os/commerce/catalog/local_media_store.js";
import { validateProductMedia, type ProductMedia } from "../src/os/commerce/catalog/product_media_types.js";
import {
  computeCommerceMediaContentHash,
} from "../src/os/commerce/catalog/product_media_content_address.js";
import {
  UnavailableProductMediaEncryption,
  contentAddressPublicMedia,
  encryptThenContentAddressProtectedMedia,
  type ProductMediaEncryptionPort,
} from "../src/os/commerce/catalog/product_media_encryption.js";
import {
  isSafeCommerceImageReference,
  isSafeCommerceMediaReference,
  isSafeCommerceOpaqueMediaRef,
} from "../src/os/commerce/catalog/safe_media_reference.js";
import { buildProductMediaPlaybackDescriptor } from "../src/os/commerce/catalog/product_media_playback.js";
import type { Product, PurchaseGrant } from "../src/os/commerce/catalog/types.js";

const MERCHANT = "d".repeat(64);
const STRANGER = "e".repeat(64);
const BUYER = "f0".repeat(32);

const SAFE_PNG_DATA_URI = "data:image/png;base64,aGVsbG8=";

// ---------------------------------------------------------------------
// validateProductMedia
// ---------------------------------------------------------------------

function validMediaFields() {
  return {
    role: "primary" as const,
    classification: "public" as const,
    contentType: "image/png",
    sizeBytes: 10,
    checksum: "a".repeat(64),
    checksumSubject: "plaintext" as const,
    storageRef: "abc123",
  };
}

describe("validateProductMedia", () => {
  it("1. accepts a well-formed public record", () => {
    expect(validateProductMedia(validMediaFields())).toEqual({ valid: true, reason: "valid" });
  });

  it("2. rejects an unknown role/classification/checksumSubject", () => {
    expect(validateProductMedia({ ...validMediaFields(), role: "poster" as never }).valid).toBe(false);
    expect(validateProductMedia({ ...validMediaFields(), classification: "secret" as never }).valid).toBe(false);
    expect(validateProductMedia({ ...validMediaFields(), checksumSubject: "hash" as never }).valid).toBe(false);
  });

  it("3. rejects a malformed checksum (WRONG HASH/CID/REFERENCE shape)", () => {
    expect(validateProductMedia({ ...validMediaFields(), checksum: "not-a-hash" }).valid).toBe(false);
    expect(validateProductMedia({ ...validMediaFields(), checksum: "a".repeat(63) }).valid).toBe(false);
  });

  it("4. rejects a blank contentType/storageRef and a negative sizeBytes", () => {
    expect(validateProductMedia({ ...validMediaFields(), contentType: "" }).valid).toBe(false);
    expect(validateProductMedia({ ...validMediaFields(), storageRef: "" }).valid).toBe(false);
    expect(validateProductMedia({ ...validMediaFields(), sizeBytes: -1 }).valid).toBe(false);
  });

  it("5. CORE §8 RULE: protected media must have checksumSubject \"ciphertext\", never \"plaintext\"", () => {
    const protectedWithPlaintextHash = {
      ...validMediaFields(),
      classification: "protected" as const,
      checksumSubject: "plaintext" as const,
    };
    const result = validateProductMedia(protectedWithPlaintextHash);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/never exposed/i);

    const protectedWithCiphertextHash = {
      ...validMediaFields(),
      classification: "protected" as const,
      checksumSubject: "ciphertext" as const,
    };
    expect(validateProductMedia(protectedWithCiphertextHash).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------
// safe_media_reference
// ---------------------------------------------------------------------

describe("safe media reference validators", () => {
  it("6. accepts only the allowlisted data:image/...;base64, prefixes for image roles", () => {
    expect(isSafeCommerceImageReference(SAFE_PNG_DATA_URI)).toBe(true);
    expect(isSafeCommerceImageReference("data:image/jpeg;base64,aGVsbG8=")).toBe(true);
    expect(isSafeCommerceImageReference("data:image/png;base64,")).toBe(false); // empty payload
  });

  it("7. UNSAFE SCHEME: rejects javascript:/file:///data:text-html/svg for image roles", () => {
    expect(isSafeCommerceImageReference("javascript:alert(1)")).toBe(false);
    expect(isSafeCommerceImageReference("file:///etc/passwd")).toBe(false);
    expect(isSafeCommerceImageReference("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeCommerceImageReference("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(isSafeCommerceImageReference("https://evil.example/x.png")).toBe(false);
  });

  it("8. opaque media refs (video/sample storageRef) accept only a narrow safe charset", () => {
    const key = computeCommerceMediaContentHash(new Uint8Array([1, 2, 3]));
    expect(isSafeCommerceOpaqueMediaRef(key)).toBe(true);
    expect(isSafeCommerceOpaqueMediaRef("abc-DEF_123")).toBe(true);
  });

  it("9. UNSAFE SCHEME: opaque media refs reject anything scheme-shaped", () => {
    expect(isSafeCommerceOpaqueMediaRef("javascript:alert(1)")).toBe(false);
    expect(isSafeCommerceOpaqueMediaRef("file:///etc/passwd")).toBe(false);
    expect(isSafeCommerceOpaqueMediaRef("https://evil.example/payload")).toBe(false);
    expect(isSafeCommerceOpaqueMediaRef("../../etc/passwd")).toBe(false);
    expect(isSafeCommerceOpaqueMediaRef("")).toBe(false);
  });

  it("10. isSafeCommerceMediaReference dispatches by role: image roles need a data URI, video/sample need an opaque ref", () => {
    expect(isSafeCommerceMediaReference("primary", SAFE_PNG_DATA_URI)).toBe(true);
    expect(isSafeCommerceMediaReference("primary", "abc123")).toBe(false); // opaque ref is NOT a valid image reference
    expect(isSafeCommerceMediaReference("video", "abc123")).toBe(true);
    expect(isSafeCommerceMediaReference("video", SAFE_PNG_DATA_URI)).toBe(false); // data URI is NOT a valid opaque ref
    expect(isSafeCommerceMediaReference("sample", "abc123")).toBe(true);
    expect(isSafeCommerceMediaReference("sample", "javascript:alert(1)")).toBe(false);
  });
});

// ---------------------------------------------------------------------
// product_media_encryption
// ---------------------------------------------------------------------

describe("encrypt-before-content-addressing pipeline (§8)", () => {
  it("11. public media is content-addressed over PLAINTEXT bytes directly (explicit classification, no encryption needed)", () => {
    const plaintext = new Uint8Array([10, 20, 30]);
    const result = contentAddressPublicMedia(plaintext);
    expect(result.checksumSubject).toBe("plaintext");
    expect(result.checksum).toBe(computeCommerceMediaContentHash(plaintext));
  });

  it("12. SAFE DEFAULT: UnavailableProductMediaEncryption never fabricates ciphertext — protected media pipeline reports encryption-unavailable", async () => {
    const plaintext = new Uint8Array([1, 2, 3]);
    const result = await encryptThenContentAddressProtectedMedia(plaintext, new UnavailableProductMediaEncryption());
    expect(result.outcome).toBe("encryption-unavailable");
  });

  it("13. with a real (test-injected) encryption Port, the checksum is computed over the CIPHERTEXT, never the plaintext", async () => {
    const plaintext = new Uint8Array([1, 2, 3, 4]);
    const fakeCiphertext = new Uint8Array([9, 9, 9, 9, 9]); // deliberately different length/bytes from plaintext
    const testPort: ProductMediaEncryptionPort = {
      async encrypt(bytes) {
        expect(bytes).toEqual(plaintext); // encryption really is called with the plaintext
        return fakeCiphertext;
      },
    };

    const result = await encryptThenContentAddressProtectedMedia(plaintext, testPort);
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.checksumSubject).toBe("ciphertext");
    expect(result.checksum).toBe(computeCommerceMediaContentHash(fakeCiphertext));
    expect(result.checksum).not.toBe(computeCommerceMediaContentHash(plaintext));
  });

  it("14. a throwing encryption Port fails closed (encryption-unavailable), never throws out of the pipeline", async () => {
    const throwingPort: ProductMediaEncryptionPort = {
      async encrypt(): Promise<Uint8Array | null> {
        throw new Error("boom");
      },
    };
    const result = await encryptThenContentAddressProtectedMedia(new Uint8Array([1]), throwingPort);
    expect(result.outcome).toBe("encryption-unavailable");
  });
});

// ---------------------------------------------------------------------
// product_media_playback (renderer seam)
// ---------------------------------------------------------------------

function activeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    kind: "pdf",
    title: "Product",
    creatorPubkey: MERCHANT,
    priceCents: 100,
    currency: "USD",
    status: "active",
    visibility: "public",
    linkedSpaceIds: [],
    linkedEventIds: [],
    assetIds: [],
    ...overrides,
  };
}

function media(overrides: Partial<ProductMedia> = {}): ProductMedia {
  return {
    id: "m1",
    productId: "prod-1",
    role: "primary",
    classification: "public",
    contentType: "image/png",
    sizeBytes: 10,
    checksum: "a".repeat(64),
    checksumSubject: "plaintext",
    storageRef: "abc123",
    ...overrides,
  };
}

describe("buildProductMediaPlaybackDescriptor", () => {
  it("15. IMAGE: renders when available + safe + a resolved data URI is supplied", () => {
    const descriptor = buildProductMediaPlaybackDescriptor({
      media: media(),
      product: activeProduct(),
      actorPubkey: "",
      grants: [],
      bytesAvailable: true,
      resolvedImageDataUri: SAFE_PNG_DATA_URI,
    });
    expect(descriptor.kind).toBe("image");
    expect(descriptor.safeToRender).toBe(true);
    expect(descriptor.renderableDataUri).toBe(SAFE_PNG_DATA_URI);
    expect(descriptor.downloadAllowed).toBe(false);
  });

  it("16. IMAGE, MISSING/UNAVAILABLE MEDIA: falls back safely, never marks unavailable media as renderable", () => {
    const descriptor = buildProductMediaPlaybackDescriptor({
      media: media(),
      product: activeProduct(),
      actorPubkey: "",
      grants: [],
      bytesAvailable: false,
      resolvedImageDataUri: SAFE_PNG_DATA_URI,
    });
    expect(descriptor.safeToRender).toBe(false);
    expect(descriptor.renderableDataUri).toBeNull();
  });

  it("17. IMAGE, UNSAFE reference: a resolved value that fails the allowlist is never marked safe, even if bytes are available", () => {
    const descriptor = buildProductMediaPlaybackDescriptor({
      media: media(),
      product: activeProduct(),
      actorPubkey: "",
      grants: [],
      bytesAvailable: true,
      resolvedImageDataUri: "javascript:alert(1)",
    });
    expect(descriptor.safeToRender).toBe(false);
    expect(descriptor.renderableDataUri).toBeNull();
  });

  it("18. VIDEO (PARTIAL): reports real metadata but never marks itself safe to render — no player is wired", () => {
    const descriptor = buildProductMediaPlaybackDescriptor({
      media: media({ role: "video", contentType: "video/mp4", storageRef: "videoref1" }),
      product: activeProduct(),
      actorPubkey: "",
      grants: [],
      bytesAvailable: true,
    });
    expect(descriptor.kind).toBe("video");
    expect(descriptor.contentType).toBe("video/mp4");
    expect(descriptor.storageRefIsSafe).toBe(true);
    expect(descriptor.safeToRender).toBe(false);
    expect(descriptor.renderableDataUri).toBeNull();
    expect(descriptor.downloadAllowed).toBe(false);
  });

  it("19. SAMPLE, gated by policy: creator can download, a stranger without a grant cannot", () => {
    const sampleMedia = media({ role: "sample", contentType: "application/pdf", storageRef: "sampleref1" });
    const product = activeProduct();

    const asCreator = buildProductMediaPlaybackDescriptor({
      media: sampleMedia,
      product,
      actorPubkey: MERCHANT,
      grants: [],
      bytesAvailable: true,
    });
    expect(asCreator.kind).toBe("sample");
    expect(asCreator.downloadAllowed).toBe(true);

    const asStranger = buildProductMediaPlaybackDescriptor({
      media: sampleMedia,
      product,
      actorPubkey: STRANGER,
      grants: [],
      bytesAvailable: true,
    });
    expect(asStranger.downloadAllowed).toBe(false);
  });

  it("20. SAMPLE, valid purchase grant: a buyer with a non-revoked grant can download", () => {
    const sampleMedia = media({ role: "sample", contentType: "application/zip", storageRef: "sampleref2" });
    const product = activeProduct();
    const grants: PurchaseGrant[] = [{ productId: product.id, buyerPubkey: BUYER, grantedAt: 1, source: "manual" }];

    const descriptor = buildProductMediaPlaybackDescriptor({
      media: sampleMedia,
      product,
      actorPubkey: BUYER,
      grants,
      bytesAvailable: true,
    });
    expect(descriptor.downloadAllowed).toBe(true);
  });

  it("21. SAMPLE, unsafe storageRef: never allowed to download regardless of authority", () => {
    const sampleMedia = media({ role: "sample", contentType: "application/pdf", storageRef: "javascript:alert(1)" });
    const product = activeProduct();
    const descriptor = buildProductMediaPlaybackDescriptor({
      media: sampleMedia,
      product,
      actorPubkey: MERCHANT,
      grants: [],
      bytesAvailable: true,
    });
    expect(descriptor.storageRefIsSafe).toBe(false);
    expect(descriptor.downloadAllowed).toBe(false);
  });

  it("22. SAMPLE, OFFLINE/UNAVAILABLE: authority alone is not enough — bytes must also be available", () => {
    const sampleMedia = media({ role: "sample", contentType: "application/pdf", storageRef: "sampleref3" });
    const product = activeProduct();
    const descriptor = buildProductMediaPlaybackDescriptor({
      media: sampleMedia,
      product,
      actorPubkey: MERCHANT,
      grants: [],
      bytesAvailable: false,
    });
    expect(descriptor.downloadAllowed).toBe(false);
  });
});

// ---------------------------------------------------------------------
// LocalProductMediaRepository — merchant authority over media records
// ---------------------------------------------------------------------

describe("LocalProductMediaRepository authority + validation", () => {
  it("23. only the owning merchant may add/remove media for their product", () => {
    const products = new LocalProductRepository();
    const mediaRepo = new LocalProductMediaRepository();
    const created = products.create(MERCHANT, {
      kind: "pdf",
      title: "T",
      priceCents: 100,
      currency: "USD",
      visibility: "public",
    });
    if (created.outcome !== "ok") throw new Error("unreachable");
    const product = created.product;

    const forbidden = mediaRepo.add(STRANGER, product, {
      role: "primary",
      classification: "public",
      contentType: "image/png",
      sizeBytes: 5,
      checksum: computeCommerceMediaContentHash(new Uint8Array([1])),
      checksumSubject: "plaintext",
      storageRef: "ref1",
    });
    expect(forbidden.outcome).toBe("forbidden");

    const ok = mediaRepo.add(MERCHANT, product, {
      role: "primary",
      classification: "public",
      contentType: "image/png",
      sizeBytes: 5,
      checksum: computeCommerceMediaContentHash(new Uint8Array([1])),
      checksumSubject: "plaintext",
      storageRef: "ref1",
    });
    expect(ok.outcome).toBe("ok");
    if (ok.outcome !== "ok") throw new Error("unreachable");

    expect(mediaRepo.remove(STRANGER, product, ok.media.id).outcome).toBe("forbidden");
    expect(mediaRepo.remove(MERCHANT, product, ok.media.id).outcome).toBe("ok");
    expect(mediaRepo.listForProduct(product.id)).toHaveLength(0);
  });

  it("24. rejects an invalid record (e.g. protected + plaintext checksumSubject) before it is ever stored", () => {
    const products = new LocalProductRepository();
    const mediaRepo = new LocalProductMediaRepository();
    const created = products.create(MERCHANT, {
      kind: "pdf",
      title: "T",
      priceCents: 100,
      currency: "USD",
      visibility: "public",
    });
    if (created.outcome !== "ok") throw new Error("unreachable");

    const result = mediaRepo.add(MERCHANT, created.product, {
      role: "gallery",
      classification: "protected",
      contentType: "image/png",
      sizeBytes: 5,
      checksum: computeCommerceMediaContentHash(new Uint8Array([1])),
      checksumSubject: "plaintext",
      storageRef: "ref2",
    });
    expect(result.outcome).toBe("invalid-input");
    expect(mediaRepo.listForProduct(created.product.id)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------
// Acceptance data (§29): Product A/B/C, full pipeline, edge cases
// ---------------------------------------------------------------------

describe("acceptance data: Product A (image only)", () => {
  it("25. end-to-end: create product, store image bytes content-addressed, add media record, render", () => {
    const products = new LocalProductRepository();
    const mediaRepo = new LocalProductMediaRepository();
    const store = new LocalMediaStore(1_000_000, ["image/png"]);

    const created = products.create(MERCHANT, {
      kind: "other",
      title: "Product A",
      priceCents: 1000,
      currency: "USD",
      visibility: "public",
    });
    if (created.outcome !== "ok") throw new Error("unreachable");
    products.publish(MERCHANT, created.product.id);
    const product = products.get(created.product.id)!;

    const imageBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7]);
    const stored = store.put({ bytes: imageBytes, contentType: "image/png" });
    if (stored.outcome !== "stored") throw new Error("unreachable");

    const addResult = mediaRepo.add(MERCHANT, product, {
      role: "primary",
      classification: "public",
      contentType: "image/png",
      sizeBytes: stored.metadata.sizeBytes,
      checksum: stored.metadata.checksum,
      checksumSubject: "plaintext",
      altText: "Product A photo",
      storageRef: stored.metadata.key,
    });
    expect(addResult.outcome).toBe("ok");
    if (addResult.outcome !== "ok") throw new Error("unreachable");

    const roundTrip = store.get(addResult.media.storageRef);
    expect(roundTrip).not.toBeNull();
    expect(mediaRepo.listForProduct(product.id)).toHaveLength(1);
  });
});

describe("acceptance data: Product B (image + video metadata)", () => {
  it("26. adds both a primary image and a video-role record; video reports PARTIAL (metadata + safety only, no player)", () => {
    const products = new LocalProductRepository();
    const mediaRepo = new LocalProductMediaRepository();
    const store = new LocalMediaStore(1_000_000, ["image/png", "video/mp4"]);

    const created = products.create(MERCHANT, {
      kind: "other",
      title: "Product B",
      priceCents: 2500,
      currency: "USD",
      visibility: "public",
    });
    if (created.outcome !== "ok") throw new Error("unreachable");
    const product = created.product;

    const image = store.put({ bytes: new Uint8Array([1, 1, 1]), contentType: "image/png" });
    const video = store.put({ bytes: new Uint8Array([2, 2, 2, 2, 2, 2]), contentType: "video/mp4" });
    if (image.outcome !== "stored" || video.outcome !== "stored") throw new Error("unreachable");

    mediaRepo.add(MERCHANT, product, {
      role: "primary",
      classification: "public",
      contentType: "image/png",
      sizeBytes: image.metadata.sizeBytes,
      checksum: image.metadata.checksum,
      checksumSubject: "plaintext",
      storageRef: image.metadata.key,
    });
    const videoAdd = mediaRepo.add(MERCHANT, product, {
      role: "video",
      classification: "public",
      contentType: "video/mp4",
      sizeBytes: video.metadata.sizeBytes,
      checksum: video.metadata.checksum,
      checksumSubject: "plaintext",
      storageRef: video.metadata.key,
    });
    if (videoAdd.outcome !== "ok") throw new Error("unreachable");

    const descriptor = buildProductMediaPlaybackDescriptor({
      media: videoAdd.media,
      product,
      actorPubkey: "",
      grants: [],
      bytesAvailable: true,
    });
    expect(descriptor.kind).toBe("video");
    expect(descriptor.safeToRender).toBe(false); // PARTIAL — see product_media_playback.ts's own header
    expect(mediaRepo.listForProduct(product.id)).toHaveLength(2);
  });
});

describe("acceptance data: Product C (image + downloadable sample)", () => {
  it("27. sample artifact is gated by policy — reachable only to creator or a valid grant holder", () => {
    const products = new LocalProductRepository();
    const mediaRepo = new LocalProductMediaRepository();
    const store = new LocalMediaStore(1_000_000, ["image/png", "application/pdf"]);

    const created = products.create(MERCHANT, {
      kind: "pdf",
      title: "Product C",
      priceCents: 500,
      currency: "USD",
      visibility: "public",
    });
    if (created.outcome !== "ok") throw new Error("unreachable");
    products.publish(MERCHANT, created.product.id);
    const product = products.get(created.product.id)!;

    const sampleBytes = new Uint8Array([5, 5, 5, 5]);
    const sample = store.put({ bytes: sampleBytes, contentType: "application/pdf" });
    if (sample.outcome !== "stored") throw new Error("unreachable");

    const sampleAdd = mediaRepo.add(MERCHANT, product, {
      role: "sample",
      classification: "public",
      contentType: "application/pdf",
      sizeBytes: sample.metadata.sizeBytes,
      checksum: sample.metadata.checksum,
      checksumSubject: "plaintext",
      storageRef: sample.metadata.key,
    });
    if (sampleAdd.outcome !== "ok") throw new Error("unreachable");

    const guestDescriptor = buildProductMediaPlaybackDescriptor({
      media: sampleAdd.media,
      product,
      actorPubkey: "",
      grants: [],
      bytesAvailable: store.exists(sampleAdd.media.storageRef),
    });
    expect(guestDescriptor.downloadAllowed).toBe(false);

    const creatorDescriptor = buildProductMediaPlaybackDescriptor({
      media: sampleAdd.media,
      product,
      actorPubkey: MERCHANT,
      grants: [],
      bytesAvailable: store.exists(sampleAdd.media.storageRef),
    });
    expect(creatorDescriptor.downloadAllowed).toBe(true);
  });
});

describe("acceptance edge cases", () => {
  it("28. MISSING MEDIA: a product with an assetIds/media reference nobody ever stored resolves to unavailable, not a crash", () => {
    const store = new LocalMediaStore(1_000_000, ["image/png"]);
    expect(store.get("never-stored")).toBeNull();
    const descriptor = buildProductMediaPlaybackDescriptor({
      media: media({ storageRef: "never-stored" }),
      product: activeProduct(),
      actorPubkey: "",
      grants: [],
      bytesAvailable: false,
    });
    expect(descriptor.available).toBe(false);
    expect(descriptor.safeToRender).toBe(false);
  });
});
