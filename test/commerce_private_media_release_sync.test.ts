import { describe, expect, it } from "vitest";
import {
  isWellFormedPrivateMediaReleaseRequestPayload,
  isWellFormedPrivateMediaReleasePayload,
  MAX_MEDIA_RELEASE_WIRE_CIPHERTEXT_CHARS,
  PRIVATE_MEDIA_RELEASE_MAX_REASON_CHARS,
  type PrivateMediaReleaseRequestPayload,
  type PrivateMediaReleasePayload,
} from "../src/os/commerce/events/commerce_private_media_release_sync.js";

/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) — structural
 * well-formedness coverage for the 4th private-sync wire shape, mirroring
 * `commerce_private_delivery_sync.test.ts`'s own allowlist/bound-checking
 * discipline.
 */

const BUYER = "b".repeat(64);
const SELLER = "c".repeat(64);
const DIGEST = "d".repeat(64);

function validRequest(overrides: Partial<PrivateMediaReleaseRequestPayload> = {}): PrivateMediaReleaseRequestPayload {
  return {
    category: "private-media-release-request",
    formatVersion: 1,
    orderId: "order-1",
    mediaId: "media-1",
    buyerPubkey: BUYER,
    sellerPubkey: SELLER,
    at: 1_700_000_000,
    ...overrides,
  };
}

function validReleased(overrides: Partial<PrivateMediaReleasePayload> = {}): PrivateMediaReleasePayload {
  return {
    category: "private-media-release",
    formatVersion: 1,
    outcome: "released",
    orderId: "order-1",
    mediaId: "media-1",
    buyerPubkey: BUYER,
    sellerPubkey: SELLER,
    grantVersion: 1,
    contentType: "application/pdf",
    contentDigest: DIGEST,
    wireCiphertext: "abc123",
    at: 1_700_000_000,
    ...overrides,
  } as PrivateMediaReleasePayload;
}

function validDenied(overrides: Partial<PrivateMediaReleasePayload> = {}): PrivateMediaReleasePayload {
  return {
    category: "private-media-release",
    formatVersion: 1,
    outcome: "denied",
    orderId: "order-1",
    mediaId: "media-1",
    buyerPubkey: BUYER,
    sellerPubkey: SELLER,
    reason: "order-not-qualifying",
    at: 1_700_000_000,
    ...overrides,
  } as PrivateMediaReleasePayload;
}

describe("isWellFormedPrivateMediaReleaseRequestPayload", () => {
  it("accepts a well-formed request", () => {
    expect(isWellFormedPrivateMediaReleaseRequestPayload(validRequest())).toBe(true);
  });

  it("rejects wrong category/formatVersion", () => {
    expect(isWellFormedPrivateMediaReleaseRequestPayload({ ...validRequest(), category: "private-delivery-sync" })).toBe(false);
    expect(isWellFormedPrivateMediaReleaseRequestPayload({ ...validRequest(), formatVersion: 2 })).toBe(false);
  });

  it("rejects non-hex64 buyer/seller pubkeys", () => {
    expect(isWellFormedPrivateMediaReleaseRequestPayload({ ...validRequest(), buyerPubkey: "not-hex" })).toBe(false);
    expect(isWellFormedPrivateMediaReleaseRequestPayload({ ...validRequest(), sellerPubkey: "short" })).toBe(false);
  });

  it("rejects buyerPubkey === sellerPubkey (self-dealing)", () => {
    expect(isWellFormedPrivateMediaReleaseRequestPayload({ ...validRequest(), sellerPubkey: BUYER })).toBe(false);
  });

  it("rejects extra/unknown keys", () => {
    expect(isWellFormedPrivateMediaReleaseRequestPayload({ ...validRequest(), extra: "x" })).toBe(false);
  });

  it("rejects empty orderId/mediaId and non-integer at", () => {
    expect(isWellFormedPrivateMediaReleaseRequestPayload({ ...validRequest(), orderId: "" })).toBe(false);
    expect(isWellFormedPrivateMediaReleaseRequestPayload({ ...validRequest(), mediaId: "" })).toBe(false);
    expect(isWellFormedPrivateMediaReleaseRequestPayload({ ...validRequest(), at: 1.5 })).toBe(false);
  });

  it("never throws on garbage input", () => {
    for (const garbage of [null, undefined, 42, "x", [], {}]) {
      expect(() => isWellFormedPrivateMediaReleaseRequestPayload(garbage)).not.toThrow();
      expect(isWellFormedPrivateMediaReleaseRequestPayload(garbage)).toBe(false);
    }
  });
});

describe("isWellFormedPrivateMediaReleasePayload — outcome: released", () => {
  it("accepts a well-formed released payload", () => {
    expect(isWellFormedPrivateMediaReleasePayload(validReleased())).toBe(true);
  });

  it("rejects a non-positive/non-integer grantVersion", () => {
    expect(isWellFormedPrivateMediaReleasePayload(validReleased({ grantVersion: 0 } as never))).toBe(false);
    expect(isWellFormedPrivateMediaReleasePayload(validReleased({ grantVersion: -1 } as never))).toBe(false);
    expect(isWellFormedPrivateMediaReleasePayload(validReleased({ grantVersion: 1.5 } as never))).toBe(false);
  });

  it("rejects a malformed contentDigest (must be sha256 hex)", () => {
    expect(isWellFormedPrivateMediaReleasePayload(validReleased({ contentDigest: "not-hex" } as never))).toBe(false);
    expect(isWellFormedPrivateMediaReleasePayload(validReleased({ contentDigest: "a".repeat(63) } as never))).toBe(false);
  });

  it("rejects an empty or oversized wireCiphertext", () => {
    expect(isWellFormedPrivateMediaReleasePayload(validReleased({ wireCiphertext: "" } as never))).toBe(false);
    expect(
      isWellFormedPrivateMediaReleasePayload(validReleased({ wireCiphertext: "a".repeat(MAX_MEDIA_RELEASE_WIRE_CIPHERTEXT_CHARS + 1) } as never)),
    ).toBe(false);
  });

  it("rejects an empty contentType", () => {
    expect(isWellFormedPrivateMediaReleasePayload(validReleased({ contentType: "" } as never))).toBe(false);
  });

  it("rejects a 'released' payload carrying a 'denied'-only field, and vice versa", () => {
    expect(isWellFormedPrivateMediaReleasePayload({ ...validReleased(), reason: "x" })).toBe(false);
    expect(isWellFormedPrivateMediaReleasePayload({ ...validDenied(), wireCiphertext: "abc" })).toBe(false);
  });
});

describe("isWellFormedPrivateMediaReleasePayload — outcome: denied", () => {
  it("accepts a well-formed denied payload", () => {
    expect(isWellFormedPrivateMediaReleasePayload(validDenied())).toBe(true);
  });

  it("rejects an empty or oversized reason", () => {
    expect(isWellFormedPrivateMediaReleasePayload(validDenied({ reason: "" } as never))).toBe(false);
    expect(isWellFormedPrivateMediaReleasePayload(validDenied({ reason: "x".repeat(PRIVATE_MEDIA_RELEASE_MAX_REASON_CHARS + 1) } as never))).toBe(
      false,
    );
  });

  it("rejects an unknown outcome value entirely", () => {
    expect(isWellFormedPrivateMediaReleasePayload({ ...validDenied(), outcome: "pending" })).toBe(false);
  });

  it("never throws on garbage input", () => {
    for (const garbage of [null, undefined, 42, "x", [], {}, { outcome: "released" }]) {
      expect(() => isWellFormedPrivateMediaReleasePayload(garbage)).not.toThrow();
      expect(isWellFormedPrivateMediaReleasePayload(garbage)).toBe(false);
    }
  });
});
