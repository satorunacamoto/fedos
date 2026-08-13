import { describe, expect, it } from "vitest";
import {
  evaluateInboundMediaReleaseRequestAuthorization,
  evaluateInboundMediaReleaseResponseAuthorization,
  evaluateDigitalContentDeliveryInvariantForOrderCompletion,
} from "../src/os/commerce/media_grant/media_access_grant_release_channel_policy.js";

/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) — pure
 * decision-layer coverage for the media-release channel's own
 * request/response authorization gates and the order-completion "digital
 * content delivery invariant".
 */

const BUYER = "b".repeat(64);
const OTHER_BUYER = "c".repeat(64);
const SELLER = "d".repeat(64);
const OTHER_SELLER = "e".repeat(64);
const ORDER_ID = "order-1";
const MEDIA_ID = "media-1";
const PRODUCT_ID = "product-1";

describe("evaluateInboundMediaReleaseRequestAuthorization", () => {
  const order = { id: ORDER_ID, productId: PRODUCT_ID, buyerPubkey: BUYER, sellerPubkey: SELLER };
  const media = { id: MEDIA_ID, productId: PRODUCT_ID, classification: "protected" as const };
  const payload = { orderId: ORDER_ID, mediaId: MEDIA_ID, buyerPubkey: BUYER, sellerPubkey: SELLER };

  it("PASS: real sender === payload buyer, addressed to me, real matching order+protected media", () => {
    const result = evaluateInboundMediaReleaseRequestAuthorization({ payload, senderPubkeyHex: BUYER, ownPubkeyHex: SELLER, order, media });
    expect(result).toEqual({ authorized: true });
  });

  it("REJECT: sender is not the claimed buyer (spoofed buyerPubkey in the payload body)", () => {
    const result = evaluateInboundMediaReleaseRequestAuthorization({
      payload,
      senderPubkeyHex: OTHER_BUYER, // real sender differs from payload.buyerPubkey
      ownPubkeyHex: SELLER,
      order,
      media,
    });
    expect(result).toEqual({ authorized: false, reason: "sender-mismatch" });
  });

  it("REJECT: request addressed to a different seller (own identity mismatch)", () => {
    const result = evaluateInboundMediaReleaseRequestAuthorization({
      payload,
      senderPubkeyHex: BUYER,
      ownPubkeyHex: OTHER_SELLER,
      order,
      media,
    });
    expect(result).toEqual({ authorized: false, reason: "not-addressed-to-me" });
  });

  it("REJECT: no local Order found for the claimed orderId", () => {
    const result = evaluateInboundMediaReleaseRequestAuthorization({
      payload,
      senderPubkeyHex: BUYER,
      ownPubkeyHex: SELLER,
      order: undefined,
      media,
    });
    expect(result).toEqual({ authorized: false, reason: "order-not-found" });
  });

  it("REJECT: local Order exists but its real buyer/seller differ from the claimed payload fields", () => {
    const mismatchedOrder = { ...order, buyerPubkey: OTHER_BUYER };
    const result = evaluateInboundMediaReleaseRequestAuthorization({
      payload,
      senderPubkeyHex: BUYER,
      ownPubkeyHex: SELLER,
      order: mismatchedOrder,
      media,
    });
    expect(result).toEqual({ authorized: false, reason: "order-mismatch" });
  });

  it("REJECT: claimed media does not exist / belongs to a different product", () => {
    const wrongProductMedia = { id: MEDIA_ID, productId: "other-product", classification: "protected" as const };
    const result = evaluateInboundMediaReleaseRequestAuthorization({
      payload,
      senderPubkeyHex: BUYER,
      ownPubkeyHex: SELLER,
      order,
      media: wrongProductMedia,
    });
    expect(result).toEqual({ authorized: false, reason: "media-not-found" });
  });

  it("REJECT: media exists but is public, not protected", () => {
    const publicMedia = { id: MEDIA_ID, productId: PRODUCT_ID, classification: "public" as const };
    const result = evaluateInboundMediaReleaseRequestAuthorization({
      payload,
      senderPubkeyHex: BUYER,
      ownPubkeyHex: SELLER,
      order,
      media: publicMedia,
    });
    expect(result).toEqual({ authorized: false, reason: "media-not-protected" });
  });
});

describe("evaluateInboundMediaReleaseResponseAuthorization", () => {
  const order = { id: ORDER_ID, sellerPubkey: SELLER };
  const payload = { orderId: ORDER_ID, mediaId: MEDIA_ID, buyerPubkey: BUYER, sellerPubkey: SELLER };

  it("PASS: real sender === this order's own real seller, addressed to me, matching order/media", () => {
    const result = evaluateInboundMediaReleaseResponseAuthorization({
      payload,
      senderPubkeyHex: SELLER,
      ownPubkeyHex: BUYER,
      order,
      expectedMediaId: MEDIA_ID,
    });
    expect(result).toEqual({ authorized: true });
  });

  it("REJECT: real sender is NOT this order's own seller (a seller cannot spoof a different order's release)", () => {
    const result = evaluateInboundMediaReleaseResponseAuthorization({
      payload,
      senderPubkeyHex: OTHER_SELLER,
      ownPubkeyHex: BUYER,
      order,
      expectedMediaId: MEDIA_ID,
    });
    expect(result).toEqual({ authorized: false, reason: "sender-mismatch" });
  });

  it("REJECT: payload's own claimed sellerPubkey field disagrees with the real, locally-trusted seller", () => {
    const spoofedPayload = { ...payload, sellerPubkey: OTHER_SELLER };
    const result = evaluateInboundMediaReleaseResponseAuthorization({
      payload: spoofedPayload,
      senderPubkeyHex: SELLER,
      ownPubkeyHex: BUYER,
      order,
      expectedMediaId: MEDIA_ID,
    });
    expect(result).toEqual({ authorized: false, reason: "sender-mismatch" });
  });

  it("REJECT: response is addressed to a different buyer", () => {
    const result = evaluateInboundMediaReleaseResponseAuthorization({
      payload: { ...payload, buyerPubkey: OTHER_BUYER },
      senderPubkeyHex: SELLER,
      ownPubkeyHex: BUYER,
      order,
      expectedMediaId: MEDIA_ID,
    });
    expect(result).toEqual({ authorized: false, reason: "not-addressed-to-me" });
  });

  it("REJECT: response for a different order/media than expected (cross-order/cross-media replay)", () => {
    const result1 = evaluateInboundMediaReleaseResponseAuthorization({
      payload: { ...payload, orderId: "other-order" },
      senderPubkeyHex: SELLER,
      ownPubkeyHex: BUYER,
      order,
      expectedMediaId: MEDIA_ID,
    });
    expect(result1).toEqual({ authorized: false, reason: "order-mismatch" });

    const result2 = evaluateInboundMediaReleaseResponseAuthorization({
      payload: { ...payload, mediaId: "other-media" },
      senderPubkeyHex: SELLER,
      ownPubkeyHex: BUYER,
      order,
      expectedMediaId: MEDIA_ID,
    });
    expect(result2).toEqual({ authorized: false, reason: "order-mismatch" });
  });
});

describe("evaluateDigitalContentDeliveryInvariantForOrderCompletion", () => {
  it("PASS (no-op): a product with no protected media is never blocked", () => {
    const result = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: PRODUCT_ID,
      productMedia: [{ id: "img-1", productId: PRODUCT_ID, classification: "public" }],
      hasReleasedContent: () => false,
    });
    expect(result).toEqual({ satisfied: true });
  });

  it("PASS: every protected media item for this product has a real release on file", () => {
    const result = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: PRODUCT_ID,
      productMedia: [
        { id: "media-1", productId: PRODUCT_ID, classification: "protected" },
        { id: "media-2", productId: PRODUCT_ID, classification: "protected" },
        { id: "img-1", productId: PRODUCT_ID, classification: "public" },
      ],
      hasReleasedContent: () => true,
    });
    expect(result).toEqual({ satisfied: true });
  });

  it("REJECT: a protected media item has NO release on file yet -- names the missing mediaId", () => {
    const result = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: PRODUCT_ID,
      productMedia: [{ id: "media-1", productId: PRODUCT_ID, classification: "protected" }],
      hasReleasedContent: () => false,
    });
    expect(result).toEqual({ satisfied: false, reason: "digital-content-not-delivered", missingMediaIds: ["media-1"] });
  });

  it("REJECT: only SOME protected media items have been released -- names only the missing ones", () => {
    const result = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: PRODUCT_ID,
      productMedia: [
        { id: "media-1", productId: PRODUCT_ID, classification: "protected" },
        { id: "media-2", productId: PRODUCT_ID, classification: "protected" },
      ],
      hasReleasedContent: (mediaId) => mediaId === "media-1",
    });
    expect(result).toEqual({ satisfied: false, reason: "digital-content-not-delivered", missingMediaIds: ["media-2"] });
  });

  it("ignores protected media belonging to a DIFFERENT product", () => {
    const result = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: PRODUCT_ID,
      productMedia: [{ id: "media-1", productId: "other-product", classification: "protected" }],
      hasReleasedContent: () => false,
    });
    expect(result).toEqual({ satisfied: true });
  });
});
