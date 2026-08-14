import { describe, it, expect } from "vitest";

import { PersonaEpochSigningKeypair } from "../src/os/commerce/reputation/persona_epoch_signing_keypair.js";
import { signMediaAccessGrant } from "../src/os/commerce/media_grant/media_access_grant_sign_verify.js";
import type { MediaAccessGrantPayload } from "../src/os/commerce/media_grant/media_access_grant_types.js";
import {
  evaluateMediaAccessGrant,
  isQualifyingOrderStatusForMediaAccess,
} from "../src/os/commerce/media_grant/media_access_grant_policy.js";
import { createOrder, applyOrderAction } from "../src/os/commerce/order/order_state_machine.js";
import type { Order } from "../src/os/commerce/order/order_types.js";

const BUYER = "b".repeat(64);
const SELLER_KP = PersonaEpochSigningKeypair.generate();
const SELLER = SELLER_KP.publicKeyHex;
const MEDIA = { id: "media-1", productId: "product-1" };
const NOW = 10_000;

/** Builds a real Order and drives it to `"paid"` via the REAL state machine (never a bare status literal) — `confirm_payment` requires `actor.kind === "payment_evidence"`, matching the state machine's own authority discipline. */
function buildPaidOrder(overrides: { readonly orderId?: string; readonly buyerPubkey?: string; readonly sellerPubkey?: string } = {}): Order {
  const orderId = overrides.orderId ?? "order-1";
  const buyerPubkey = overrides.buyerPubkey ?? BUYER;
  const sellerPubkey = overrides.sellerPubkey ?? SELLER;

  const created = createOrder(
    { id: orderId, productId: MEDIA.productId, sellerPubkey, unitPriceCents: 1000, currency: "USD" },
    { kind: "customer", pubkey: buyerPubkey },
    NOW - 300,
  );
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error("unreachable");

  const submitted = applyOrderAction(created.order, { type: "submit", actor: { kind: "customer", pubkey: buyerPubkey } }, NOW - 200);
  if (!submitted.ok) throw new Error("unreachable: submit");

  const accepted = applyOrderAction(submitted.order, { type: "accept", actor: { kind: "merchant", pubkey: sellerPubkey } }, NOW - 100);
  if (!accepted.ok) throw new Error("unreachable: accept");

  const paid = applyOrderAction(
    accepted.order,
    {
      type: "confirm_payment",
      actor: { kind: "payment_evidence" },
      evidence: { orderId, paymentId: "pay-1", status: "settled", observedAt: NOW - 50, reason: "settled by real evidence" },
    },
    NOW - 50,
  );
  if (!paid.ok) throw new Error("unreachable: confirm_payment");
  return paid.order;
}

function buildUnpaidOrder(overrides: { readonly orderId?: string; readonly buyerPubkey?: string; readonly sellerPubkey?: string } = {}): Order {
  const orderId = overrides.orderId ?? "order-1";
  const buyerPubkey = overrides.buyerPubkey ?? BUYER;
  const sellerPubkey = overrides.sellerPubkey ?? SELLER;
  const created = createOrder(
    { id: orderId, productId: MEDIA.productId, sellerPubkey, unitPriceCents: 1000, currency: "USD" },
    { kind: "customer", pubkey: buyerPubkey },
    NOW - 300,
  );
  if (!created.ok) throw new Error("unreachable");
  const submitted = applyOrderAction(created.order, { type: "submit", actor: { kind: "customer", pubkey: buyerPubkey } }, NOW - 200);
  if (!submitted.ok) throw new Error("unreachable");
  const accepted = applyOrderAction(submitted.order, { type: "accept", actor: { kind: "merchant", pubkey: sellerPubkey } }, NOW - 100);
  if (!accepted.ok) throw new Error("unreachable");
  return accepted.order; // "accepted" — never reached "paid"
}

function validPayload(overrides: Partial<MediaAccessGrantPayload> = {}): MediaAccessGrantPayload {
  return {
    formatVersion: 1,
    mediaId: MEDIA.id,
    productId: MEDIA.productId,
    buyerPubkey: BUYER,
    orderId: "order-1",
    issuerPubkey: SELLER,
    grantVersion: 1,
    revoked: false,
    validFrom: NOW - 500,
    validUntil: null,
    issuedAt: NOW - 500,
    ...overrides,
  };
}

function grantEnvelope(overrides: Partial<MediaAccessGrantPayload> = {}, signer: PersonaEpochSigningKeypair = SELLER_KP) {
  const payload = validPayload({ issuerPubkey: signer.publicKeyHex, ...overrides });
  return signMediaAccessGrant(payload, signer, { issuer: signer.publicKeyHex, issuedAt: payload.issuedAt });
}

describe("MediaAccessGrant policy: isQualifyingOrderStatusForMediaAccess", () => {
  it("qualifies paid/fulfilling/delivered/completed, and only those", () => {
    expect(isQualifyingOrderStatusForMediaAccess("paid")).toBe(true);
    expect(isQualifyingOrderStatusForMediaAccess("fulfilling")).toBe(true);
    expect(isQualifyingOrderStatusForMediaAccess("delivered")).toBe(true);
    expect(isQualifyingOrderStatusForMediaAccess("completed")).toBe(true);
    expect(isQualifyingOrderStatusForMediaAccess("created")).toBe(false);
    expect(isQualifyingOrderStatusForMediaAccess("submitted")).toBe(false);
    expect(isQualifyingOrderStatusForMediaAccess("accepted")).toBe(false);
    expect(isQualifyingOrderStatusForMediaAccess("rejected")).toBe(false);
    expect(isQualifyingOrderStatusForMediaAccess("cancelled")).toBe(false);
  });
});

describe("MediaAccessGrant policy: evaluateMediaAccessGrant — the happy path", () => {
  it("ALLOWS a valid grant against a genuinely paid, matching Order", () => {
    const order = buildPaidOrder();
    const envelope = grantEnvelope();
    const decision = evaluateMediaAccessGrant({ envelope, media: MEDIA, actorPubkey: BUYER, order, now: NOW });
    expect(decision.allowed).toBe(true);
  });

  it("ALLOWS through the rest of the successful lifecycle (fulfilling/delivered/completed), never reverts once paid", () => {
    const paid = buildPaidOrder();
    const fulfilling = applyOrderAction(paid, { type: "fulfill", actor: { kind: "merchant", pubkey: SELLER } }, NOW - 40);
    if (!fulfilling.ok) throw new Error("unreachable");
    const delivered = applyOrderAction(
      fulfilling.order,
      { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: { orderId: "order-1", deliveryId: "d-1", status: "delivered", observedAt: NOW - 30, reason: "ok" } },
      NOW - 30,
    );
    if (!delivered.ok) throw new Error("unreachable");
    const completed = applyOrderAction(delivered.order, { type: "complete", actor: { kind: "customer", pubkey: BUYER } }, NOW - 10);
    if (!completed.ok) throw new Error("unreachable");

    for (const order of [fulfilling.order, delivered.order, completed.order]) {
      const envelope = grantEnvelope();
      const decision = evaluateMediaAccessGrant({ envelope, media: MEDIA, actorPubkey: BUYER, order, now: NOW });
      expect(decision.allowed).toBe(true);
    }
  });
});

describe("MediaAccessGrant policy: failure-mode matrix", () => {
  it("NO ORDER AT ALL: denied order-not-found", () => {
    const envelope = grantEnvelope();
    const decision = evaluateMediaAccessGrant({ envelope, media: MEDIA, actorPubkey: BUYER, order: null, now: NOW });
    expect(decision).toEqual({ allowed: false, reason: "order-not-found" });
  });

  it("UNPAID ORDER: denied order-not-qualifying", () => {
    const order = buildUnpaidOrder();
    const envelope = grantEnvelope();
    const decision = evaluateMediaAccessGrant({ envelope, media: MEDIA, actorPubkey: BUYER, order, now: NOW });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe("order-not-qualifying");
  });

  it("WRONG BUYER: grant issued to X, actor Y tries to use it -- denied buyer-mismatch", () => {
    const order = buildPaidOrder();
    const envelope = grantEnvelope(); // issued to BUYER
    const decision = evaluateMediaAccessGrant({ envelope, media: MEDIA, actorPubkey: "c".repeat(64), order, now: NOW });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe("buyer-mismatch");
  });

  it("WRONG MEDIA: grant for media A used against media B -- denied media-id-mismatch", () => {
    const order = buildPaidOrder();
    const envelope = grantEnvelope();
    const decision = evaluateMediaAccessGrant({
      envelope,
      media: { id: "media-2", productId: MEDIA.productId },
      actorPubkey: BUYER,
      order,
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe("media-id-mismatch");
  });

  it("WRONG PRODUCT: denied product-id-mismatch", () => {
    const order = buildPaidOrder();
    const envelope = grantEnvelope();
    const decision = evaluateMediaAccessGrant({
      envelope,
      media: { id: MEDIA.id, productId: "product-999" },
      actorPubkey: BUYER,
      order,
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe("product-id-mismatch");
  });

  it("EXPIRED GRANT: validUntil in the past -- denied expired", () => {
    const order = buildPaidOrder();
    const envelope = grantEnvelope({ validUntil: NOW - 1 });
    const decision = evaluateMediaAccessGrant({ envelope, media: MEDIA, actorPubkey: BUYER, order, now: NOW });
    expect(decision).toEqual({ allowed: false, reason: "expired" });
  });

  it("NOT YET VALID: validFrom in the future -- denied not-yet-valid", () => {
    const order = buildPaidOrder();
    const envelope = grantEnvelope({ validFrom: NOW + 1 });
    const decision = evaluateMediaAccessGrant({ envelope, media: MEDIA, actorPubkey: BUYER, order, now: NOW });
    expect(decision).toEqual({ allowed: false, reason: "not-yet-valid" });
  });

  it("REVOKED GRANT: merchant revokes future access (data, not a fantasy 'delete the copy') -- denied revoked", () => {
    const order = buildPaidOrder();
    const envelope = grantEnvelope({ revoked: true, grantVersion: 2 });
    const decision = evaluateMediaAccessGrant({ envelope, media: MEDIA, actorPubkey: BUYER, order, now: NOW });
    expect(decision).toEqual({ allowed: false, reason: "revoked" });
  });

  it("TAMPERED GRANT: mutating one field after signing -- signature must fail (SIGNATURE_INVALID)", () => {
    const order = buildPaidOrder();
    const envelope = grantEnvelope();
    const tampered = { ...envelope, payload: { ...envelope.payload, mediaId: MEDIA.id, validUntil: 999_999_999 } };
    const decision = evaluateMediaAccessGrant({ envelope: tampered, media: MEDIA, actorPubkey: BUYER, order, now: NOW });
    expect(decision).toEqual({ allowed: false, reason: "SIGNATURE_INVALID" });
  });

  it("WRONG SIGNER: a non-merchant-authority key signs -- denied wrong-signer", () => {
    const order = buildPaidOrder();
    const impostor = PersonaEpochSigningKeypair.generate();
    const envelope = grantEnvelope({ issuerPubkey: impostor.publicKeyHex }, impostor);
    const decision = evaluateMediaAccessGrant({ envelope, media: MEDIA, actorPubkey: BUYER, order, now: NOW });
    expect(decision).toEqual({ allowed: false, reason: "wrong-signer" });
  });

  it("REPLAYED OLD/SUPERSEDED GRANT VERSION: a validly-signed but stale version is rejected once a higher version is known", () => {
    const order = buildPaidOrder();
    const envelope = grantEnvelope({ grantVersion: 1 });
    const decision = evaluateMediaAccessGrant({
      envelope,
      media: MEDIA,
      actorPubkey: BUYER,
      order,
      now: NOW,
      latestKnownGrantVersion: 2,
    });
    expect(decision).toEqual({ allowed: false, reason: "superseded" });
  });

  it("WRONG ORDER: grant's own orderId does not match the order under evaluation -- denied order-id-mismatch", () => {
    const order = buildPaidOrder({ orderId: "order-999" });
    const envelope = grantEnvelope({ orderId: "order-1" });
    const decision = evaluateMediaAccessGrant({ envelope, media: MEDIA, actorPubkey: BUYER, order, now: NOW });
    expect(decision).toEqual({ allowed: false, reason: "order-id-mismatch" });
  });

  it("REFUNDED/DISPUTED (open policy question, no auto-revoke): a paid Order whose display-only paymentStatus is 'refunded' is NOT auto-denied -- Order.status itself has no refund transition today (order_state_machine.ts's own documented gap)", () => {
    const order: Order = { ...buildPaidOrder(), paymentStatus: "refunded" };
    const envelope = grantEnvelope();
    const decision = evaluateMediaAccessGrant({ envelope, media: MEDIA, actorPubkey: BUYER, order, now: NOW });
    // Documented, deliberate current behavior -- see media_access_grant_policy.ts's
    // own header for why this is an explicit open policy question rather than a
    // silent auto-revoke invented outside this arc's own lane.
    expect(decision.allowed).toBe(true);
  });

  it("malformed/garbage envelope input is rejected without throwing", () => {
    const order = buildPaidOrder();
    expect(evaluateMediaAccessGrant({ envelope: null, media: MEDIA, actorPubkey: BUYER, order, now: NOW })).toEqual({
      allowed: false,
      reason: "MALFORMED_ENVELOPE",
    });
    expect(evaluateMediaAccessGrant({ envelope: { foo: "bar" }, media: MEDIA, actorPubkey: BUYER, order, now: NOW })).toEqual({
      allowed: false,
      reason: "MALFORMED_ENVELOPE",
    });
  });
});

describe("MediaAccessGrant policy: Real Digital Delivery mega-arc (Agent G, Grant Custody pass) — sellerAuthorizedDelegateSigningKeys, closing Blocker 5", () => {
  /**
   * The REAL production shape: `order.sellerPubkey` is the seller's real
   * Nostr identity, structurally UNRELATED to the durable media-grant
   * signing key that actually signs the envelope (unlike this file's own
   * `SELLER_KP`/`SELLER` fixture above, which — like every prior test in
   * this file — sets them equal, the lab condition that never occurs in
   * production; see `media_access_grant_issuance.ts`'s own updated header).
   */
  const REAL_SELLER_IDENTITY = PersonaEpochSigningKeypair.generate();
  const REAL_SELLER = REAL_SELLER_IDENTITY.publicKeyHex;
  const DELEGATE_KP = PersonaEpochSigningKeypair.generate();

  function realSellerPaidOrder(overrides: { readonly orderId?: string; readonly buyerPubkey?: string } = {}): Order {
    return buildPaidOrder({ ...overrides, sellerPubkey: REAL_SELLER });
  }

  it("ALLOWS a grant signed by the durable delegate key once the caller supplies it as an already-verified authorized delegate", () => {
    const order = realSellerPaidOrder();
    const envelope = grantEnvelope({ issuerPubkey: DELEGATE_KP.publicKeyHex }, DELEGATE_KP);
    const decision = evaluateMediaAccessGrant({
      envelope,
      media: MEDIA,
      actorPubkey: BUYER,
      order,
      now: NOW,
      sellerAuthorizedDelegateSigningKeys: [DELEGATE_KP.publicKeyHex],
    });
    expect(decision.allowed).toBe(true);
  });

  it("without the delegate list, the SAME grant is correctly denied wrong-signer (proves the delegate list is load-bearing, not a no-op)", () => {
    const order = realSellerPaidOrder();
    const envelope = grantEnvelope({ issuerPubkey: DELEGATE_KP.publicKeyHex }, DELEGATE_KP);
    const decision = evaluateMediaAccessGrant({ envelope, media: MEDIA, actorPubkey: BUYER, order, now: NOW });
    expect(decision).toEqual({ allowed: false, reason: "wrong-signer" });
  });

  it("WRONG SIGNER: Mallory's own real, validly-self-signed grant is REJECTED even if she supplies her OWN key as her own 'delegate' — the list only helps if it names the key that ACTUALLY signed", () => {
    const order = realSellerPaidOrder(); // Bob's real order
    const mallory = PersonaEpochSigningKeypair.generate();
    const forgedEnvelope = grantEnvelope({ issuerPubkey: mallory.publicKeyHex, buyerPubkey: BUYER }, mallory);
    const decision = evaluateMediaAccessGrant({
      envelope: forgedEnvelope,
      media: MEDIA,
      actorPubkey: BUYER,
      order,
      now: NOW,
      // Mallory cannot make her own real, verified-elsewhere delegate
      // certificate name Bob's real identity (see
      // `commerce_media_grant_signing_key_delegation_bridge.test.ts`'s own
      // "WRONG SIGNER" case) -- a composition root wired correctly never
      // populates this list with Mallory's key for Bob's order. Proven here
      // at the policy layer: even if it somehow WERE (mis-)populated with
      // an UNRELATED key, it does not help unless it is the key that
      // signed THIS envelope.
      sellerAuthorizedDelegateSigningKeys: [DELEGATE_KP.publicKeyHex],
    });
    expect(decision).toEqual({ allowed: false, reason: "wrong-signer" });
  });

  it("WRONG BUYER still rejected even with a valid delegate authorization (delegate authority does not bypass buyer binding)", () => {
    const order = realSellerPaidOrder();
    const envelope = grantEnvelope({ issuerPubkey: DELEGATE_KP.publicKeyHex }, DELEGATE_KP); // issued to BUYER
    const decision = evaluateMediaAccessGrant({
      envelope,
      media: MEDIA,
      actorPubkey: "c".repeat(64),
      order,
      now: NOW,
      sellerAuthorizedDelegateSigningKeys: [DELEGATE_KP.publicKeyHex],
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe("buyer-mismatch");
  });

  it("WRONG PRODUCT still rejected even with a valid delegate authorization (delegate authority does not bypass product binding)", () => {
    const order = realSellerPaidOrder();
    const envelope = grantEnvelope({ issuerPubkey: DELEGATE_KP.publicKeyHex }, DELEGATE_KP);
    const decision = evaluateMediaAccessGrant({
      envelope,
      media: { id: MEDIA.id, productId: "product-999" },
      actorPubkey: BUYER,
      order,
      now: NOW,
      sellerAuthorizedDelegateSigningKeys: [DELEGATE_KP.publicKeyHex],
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe("product-id-mismatch");
  });

  it("RESTART DURABILITY: a grant signed under the delegate key before a restart still verifies + ALLOWS after, given the SAME continuing delegate key", () => {
    const order = realSellerPaidOrder();
    const secretBytes = PersonaEpochSigningKeypair.generateSecretKeyBytesForSealedCustody();
    const delegateBeforeRestart = PersonaEpochSigningKeypair.fromSecretKeyBytes(secretBytes.slice());
    const envelope = grantEnvelope({ issuerPubkey: delegateBeforeRestart.publicKeyHex }, delegateBeforeRestart);

    // "Restart": a fresh keypair object restored from the same durable secret.
    const delegateAfterRestart = PersonaEpochSigningKeypair.fromSecretKeyBytes(secretBytes.slice());
    expect(delegateAfterRestart.publicKeyHex).toBe(delegateBeforeRestart.publicKeyHex);

    const decision = evaluateMediaAccessGrant({
      envelope, // the historical, pre-restart-issued grant
      media: MEDIA,
      actorPubkey: BUYER,
      order,
      now: NOW,
      sellerAuthorizedDelegateSigningKeys: [delegateAfterRestart.publicKeyHex], // re-certified post-restart
    });
    expect(decision.allowed).toBe(true);
  });

  it("omitting sellerAuthorizedDelegateSigningKeys entirely is byte-identical to passing [] (backward compatibility)", () => {
    const order = buildPaidOrder(); // the file's original SELLER/SELLER_KP fixture (direct-signer case)
    const envelope = grantEnvelope();
    const omitted = evaluateMediaAccessGrant({ envelope, media: MEDIA, actorPubkey: BUYER, order, now: NOW });
    const empty = evaluateMediaAccessGrant({ envelope, media: MEDIA, actorPubkey: BUYER, order, now: NOW, sellerAuthorizedDelegateSigningKeys: [] });
    expect(omitted).toEqual(empty);
    expect(omitted.allowed).toBe(true);
  });
});
