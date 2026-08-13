import { describe, expect, it, beforeEach } from "vitest";

import { applyOrderAction, createOrder } from "../src/os/commerce/order/order_state_machine.js";
import { LocalOrderRepository } from "../src/os/commerce/order/local_order_repository.js";
import type { Order, OrderActor } from "../src/os/commerce/order/order_types.js";

import { deriveProductDeliveryClassification, type ProductMedia } from "../src/os/commerce/catalog/product_media_types.js";
import {
  evaluateDigitalContentDeliveryInvariantForOrderCompletion,
  type DigitalContentDeliveryInvariantResult,
} from "../src/os/commerce/media_grant/media_access_grant_release_channel_policy.js";
import {
  deriveDigitalContentDeliveryDisplayState,
  describeDigitalContentDeliveryDisplayState,
} from "../src/os/commerce/media_grant/digital_content_delivery_display_state.js";

import {
  issueTradeCompletionAttestation,
  type IssueTradeCompletionAttestationRequest,
} from "../src/os/commerce/reputation/reputation_issuance.js";
import { LocalTradeCompletionAttestationStore } from "../src/os/commerce/reputation/trade_completion_attestation_store.js";
import { createPersonaEpoch } from "../src/os/commerce/reputation/persona_epoch_registry.js";

import {
  evaluateCommerceReceiptTruthfulness,
  issueSignedDeliveryReceiptProofIfTruthful,
  issueSignedTradeReceiptProofIfTruthful,
  type DeliveryReceiptProofPayload,
} from "../src/os/commerce/receipt/index.js";
import { FedosTrustSigningKeypair } from "../src/os/trust/index.js";

/**
 * Commerce Product-Media Sync + Truthful Completion mega-arc (Agent C) —
 * targeted regression coverage for:
 *   1. `deriveProductDeliveryClassification()` (requirement 1).
 *   2. The `productMediaKnowledge` fix to
 *      `evaluateDigitalContentDeliveryInvariantForOrderCompletion()`
 *      (requirement 2/6) — INCLUDING the core negative control: reproduce
 *      the exact vacuous-buyer-view shape
 *      `docs/commerce/PROTECTED-MEDIA-CROSS-PROCESS-REACHABILITY.md`'s
 *      Addendum 2 documents (an empty `productMedia` list on a process that
 *      does not actually know the real state), and prove the NEW signal
 *      closes it while the OLD default stays byte-identical.
 *   3. `deriveDigitalContentDeliveryDisplayState()`/
 *      `describeDigitalContentDeliveryDisplayState()` (requirement 6/7).
 *   4. The full pipeline, assembled exactly like
 *      `fedos_electron_beta_main.cts`'s own `handleCommerceOrderComplete()`:
 *      Order state machine -> invariant gate -> (on refusal) Order stays
 *      "delivered", reputation/receipt issuance both independently refuse
 *      too; (on success) Order reaches "completed" and both succeed. This is
 *      the mission's own required "positive control: valid release still
 *      completes correctly" alongside the negative one.
 *   5. Receipt truthfulness (requirement 3) and reputation qualification
 *      (requirement 4), including that the pre-existing anti-self-dealing/
 *      duplicate-attestation gates are untouched.
 */

const BUYER = "1".repeat(64);
const SELLER = "f".repeat(64);
const PRODUCT_ID = "product-1";
const MEDIA_ID = "media-1";
const NOW = 1_700_000_000;

const BUYER_ACTOR: OrderActor = { kind: "customer", pubkey: BUYER };
const SELLER_ACTOR: OrderActor = { kind: "merchant", pubkey: SELLER };
const PAYMENT_EVIDENCE_ACTOR: OrderActor = { kind: "payment_evidence" };
const DELIVERY_EVIDENCE_ACTOR: OrderActor = { kind: "delivery_evidence" };

// ---------------------------------------------------------------------------
// 1. Product delivery classification
// ---------------------------------------------------------------------------

describe("deriveProductDeliveryClassification", () => {
  it("no ProductMedia records at all -- pre-feature, backward-compatible 'no-digital-deliverable'", () => {
    expect(deriveProductDeliveryClassification([])).toBe("no-digital-deliverable");
  });

  it("only public media -- 'public-content-only'", () => {
    expect(deriveProductDeliveryClassification([{ classification: "public" }, { classification: "public" }])).toBe("public-content-only");
  });

  it("at least one protected item -- 'protected-digital-deliverable', regardless of how many public items are also present", () => {
    expect(deriveProductDeliveryClassification([{ classification: "public" }, { classification: "protected" }])).toBe(
      "protected-digital-deliverable",
    );
  });
});

// ---------------------------------------------------------------------------
// 2. The knowledge-provenance fix to the delivery invariant
// ---------------------------------------------------------------------------

describe("evaluateDigitalContentDeliveryInvariantForOrderCompletion -- productMediaKnowledge", () => {
  it("BACKWARD COMPAT: omitted productMediaKnowledge reproduces the EXACT pre-existing vacuous result for an empty (unsynced buyer) view", () => {
    // This is deliberately the exact shape of the documented bug: a buyer
    // process whose LocalProductMediaRepository never saw this product's
    // real media (it did not attach it -- only the seller's process did).
    const result = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: PRODUCT_ID,
      productMedia: [], // vacuous per-process view
      hasReleasedContent: () => false,
    });
    expect(result).toEqual({ satisfied: true });
  });

  it("CORE NEGATIVE CONTROL (Agent C fix): the SAME vacuous empty view, once the caller honestly declares productMediaKnowledge: 'unsynced', is NO LONGER satisfied", () => {
    const result = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: PRODUCT_ID,
      productMedia: [],
      hasReleasedContent: () => false,
      productMediaKnowledge: "unsynced",
    });
    expect(result).toEqual({ satisfied: false, reason: "product-media-knowledge-unsynced" });
  });

  it("'unsynced' + a KNOWN-missing protected item still reports the stronger, more specific 'digital-content-not-delivered' (partial knowledge of a real gap is not weakened)", () => {
    const result = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: PRODUCT_ID,
      productMedia: [{ id: MEDIA_ID, productId: PRODUCT_ID, classification: "protected" }],
      hasReleasedContent: () => false,
      productMediaKnowledge: "unsynced",
    });
    expect(result).toEqual({ satisfied: false, reason: "digital-content-not-delivered", missingMediaIds: [MEDIA_ID] });
  });

  it("'unsynced' + every KNOWN protected item released is STILL not satisfied (the list might be incomplete) -- never a false positive", () => {
    const result = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: PRODUCT_ID,
      productMedia: [{ id: MEDIA_ID, productId: PRODUCT_ID, classification: "protected" }],
      hasReleasedContent: () => true,
      productMediaKnowledge: "unsynced",
    });
    expect(result).toEqual({ satisfied: false, reason: "product-media-knowledge-unsynced" });
  });

  it("explicit 'authoritative' + empty list -- satisfied (an ordinary physical-goods Order on the seller's own process, unaffected)", () => {
    const result = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: PRODUCT_ID,
      productMedia: [],
      hasReleasedContent: () => false,
      productMediaKnowledge: "authoritative",
    });
    expect(result).toEqual({ satisfied: true });
  });

  it("POSITIVE CONTROL: 'authoritative' knowledge + every protected item released -- satisfied (the happy path is not broken by this fix)", () => {
    const result = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: PRODUCT_ID,
      productMedia: [{ id: MEDIA_ID, productId: PRODUCT_ID, classification: "protected" }],
      hasReleasedContent: () => true,
      productMediaKnowledge: "authoritative",
    });
    expect(result).toEqual({ satisfied: true });
  });
});

// ---------------------------------------------------------------------------
// 3. Buyer/seller display state
// ---------------------------------------------------------------------------

describe("deriveDigitalContentDeliveryDisplayState / describeDigitalContentDeliveryDisplayState", () => {
  it("no-digital-deliverable -- no UI claim at all, for either role", () => {
    const state = deriveDigitalContentDeliveryDisplayState({ classification: "no-digital-deliverable", invariant: { satisfied: true } });
    expect(state).toBe("no-digital-deliverable");
    expect(describeDigitalContentDeliveryDisplayState(state, "buyer").headline).toBe("");
    expect(describeDigitalContentDeliveryDisplayState(state, "seller").headline).toBe("");
  });

  it("public-content-only classification also collapses to no-digital-deliverable display state (nothing to gate)", () => {
    const state = deriveDigitalContentDeliveryDisplayState({ classification: "public-content-only", invariant: { satisfied: true } });
    expect(state).toBe("no-digital-deliverable");
  });

  it("protected + satisfied -- 'delivered', with role-appropriate honest copy", () => {
    const state = deriveDigitalContentDeliveryDisplayState({ classification: "protected-digital-deliverable", invariant: { satisfied: true } });
    expect(state).toBe("delivered");
    expect(describeDigitalContentDeliveryDisplayState(state, "buyer").headline).toBe("Content delivered");
    expect(describeDigitalContentDeliveryDisplayState(state, "seller").headline).toBe("Delivered");
  });

  it("protected + digital-content-not-delivered -- 'awaiting-seller-release', NEVER the false 'no protected content' message", () => {
    const invariant: DigitalContentDeliveryInvariantResult = { satisfied: false, reason: "digital-content-not-delivered", missingMediaIds: [MEDIA_ID] };
    const state = deriveDigitalContentDeliveryDisplayState({ classification: "protected-digital-deliverable", invariant });
    expect(state).toBe("awaiting-seller-release");
    const buyerCopy = describeDigitalContentDeliveryDisplayState(state, "buyer");
    expect(buyerCopy.headline).toBe("Delivery incomplete");
    expect(buyerCopy.headline).not.toMatch(/no protected content/i);
  });

  it("protected + product-media-knowledge-unsynced -- the DISTINCT 'availability-unknown' state, never collapsed into either neighbor", () => {
    const invariant: DigitalContentDeliveryInvariantResult = { satisfied: false, reason: "product-media-knowledge-unsynced" };
    const state = deriveDigitalContentDeliveryDisplayState({ classification: "protected-digital-deliverable", invariant });
    expect(state).toBe("availability-unknown");
    expect(state).not.toBe("no-digital-deliverable");
    expect(state).not.toBe("awaiting-seller-release");
    const buyerCopy = describeDigitalContentDeliveryDisplayState(state, "buyer");
    expect(buyerCopy.nextAction.toLowerCase()).toContain("retry");
  });
});

// ---------------------------------------------------------------------------
// 4. Full pipeline: Order state machine -> invariant gate -> reputation/receipt
// ---------------------------------------------------------------------------

/** Drives a fresh Order up to (but not through) "complete" -- mirrors
 * `handleCommerceOrderComplete()`'s own real production sequence up to the
 * point where IT calls the digital-content-delivery invariant before ever
 * attempting the "complete" action. */
function driveOrderToDelivered(repository: LocalOrderRepository, orderId: string): Order {
  const created = createOrder({ id: orderId, productId: PRODUCT_ID, sellerPubkey: SELLER, unitPriceCents: 500, currency: "USD" }, BUYER_ACTOR, NOW);
  if (!created.ok) throw new Error("test setup: createOrder failed");
  let order = created.order;
  const steps: Array<Parameters<typeof applyOrderAction>[1]> = [
    { type: "submit", actor: BUYER_ACTOR },
    { type: "accept", actor: SELLER_ACTOR },
    { type: "confirm_payment", actor: PAYMENT_EVIDENCE_ACTOR, evidence: { orderId, paymentId: "payment-1", status: "settled", observedAt: NOW, reason: "test" } },
    { type: "fulfill", actor: SELLER_ACTOR },
    { type: "confirm_delivery", actor: DELIVERY_EVIDENCE_ACTOR, evidence: { orderId, deliveryId: "delivery-1", status: "delivered", observedAt: NOW, reason: "test" } },
  ];
  for (const action of steps) {
    const result = applyOrderAction(order, action, NOW);
    if (!result.ok) throw new Error(`test setup: order transition "${action.type}" failed: ${result.reason}`);
    order = result.order;
  }
  repository.save(order);
  return order;
}

/** Mirrors `handleCommerceOrderComplete()`'s own real gate order EXACTLY:
 * evaluate the invariant BEFORE ever calling `applyOrderAction(..., {type:
 * "complete"})`; refuse without transitioning on failure. */
function attemptCompleteOrder(
  repository: LocalOrderRepository,
  order: Order,
  productMedia: readonly ProductMedia[],
  hasReleasedContent: (mediaId: string) => boolean,
): { readonly completed: boolean; readonly order: Order; readonly invariant: DigitalContentDeliveryInvariantResult } {
  const invariant = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
    productId: order.productId,
    productMedia,
    hasReleasedContent,
  });
  if (!invariant.satisfied) {
    return { completed: false, order, invariant };
  }
  const result = applyOrderAction(order, { type: "complete", actor: BUYER_ACTOR }, NOW);
  if (!result.ok) throw new Error(`unreachable: complete transition rejected despite invariant satisfied: ${result.reason}`);
  repository.save(result.order);
  return { completed: true, order: result.order, invariant };
}

function protectedMedia(): ProductMedia[] {
  return [
    {
      id: MEDIA_ID,
      productId: PRODUCT_ID,
      role: "primary",
      classification: "protected",
      contentType: "application/pdf",
      sizeBytes: 100,
      checksum: "a".repeat(64),
      checksumSubject: "ciphertext",
      storageRef: "storage-ref-1",
    },
  ];
}

describe("Full pipeline: digital order completion cannot false-green, and does not regress the happy path", () => {
  let orderRepository: LocalOrderRepository;

  beforeEach(() => {
    orderRepository = new LocalOrderRepository();
  });

  it("CORE NEGATIVE CONTROL: protected content never released -- order NEVER reaches 'completed', stays 'delivered' forever", () => {
    const order = driveOrderToDelivered(orderRepository, "order-1");
    const attempt = attemptCompleteOrder(orderRepository, order, protectedMedia(), () => false);
    expect(attempt.completed).toBe(false);
    expect(attempt.order.status).toBe("delivered");
    expect(attempt.invariant).toEqual({ satisfied: false, reason: "digital-content-not-delivered", missingMediaIds: [MEDIA_ID] });

    // Reputation: the order never genuinely completed, so attestation is
    // refused at Gate #1 -- it can never produce the same positive signal a
    // genuine delivery would.
    const store = new LocalTradeCompletionAttestationStore();
    const attestorEpoch = createPersonaEpoch(NOW, NOW + 1_000_000);
    const subjectEpoch = createPersonaEpoch(NOW, NOW + 1_000_000);
    const request: IssueTradeCompletionAttestationRequest = {
      orderId: "order-1",
      attestorRole: "buyer",
      attestorRealPubkey: BUYER,
      attestorEpoch: attestorEpoch.epoch,
      attestorSigningKeypair: attestorEpoch.keypair,
      subjectEpoch: subjectEpoch.epoch,
      category: "digital_good",
      outcome: "completed_as_agreed",
    };
    const attestationResult = issueTradeCompletionAttestation({ orderRepository, store }, request, NOW);
    expect(attestationResult).toEqual({ ok: false, code: "order_not_completed", reason: expect.any(String) });

    // Receipt: never issuable either, for the same real reason.
    const receiptDecision = evaluateCommerceReceiptTruthfulness({ kind: "delivery_confirmation", orderStatus: attempt.order.status });
    expect(receiptDecision).toEqual({ permitted: false, reason: "order-not-completed" });
  });

  it("POSITIVE CONTROL: protected content genuinely released -- order reaches 'completed', reputation AND a truthful delivery receipt both succeed", () => {
    const order = driveOrderToDelivered(orderRepository, "order-2");
    const attempt = attemptCompleteOrder(orderRepository, order, protectedMedia(), (mediaId) => mediaId === MEDIA_ID);
    expect(attempt.completed).toBe(true);
    expect(attempt.order.status).toBe("completed");
    expect(attempt.invariant).toEqual({ satisfied: true });

    const store = new LocalTradeCompletionAttestationStore();
    const attestorEpoch = createPersonaEpoch(NOW, NOW + 1_000_000);
    const subjectEpoch = createPersonaEpoch(NOW, NOW + 1_000_000);
    const attestationResult = issueTradeCompletionAttestation(
      { orderRepository, store },
      {
        orderId: "order-2",
        attestorRole: "buyer",
        attestorRealPubkey: BUYER,
        attestorEpoch: attestorEpoch.epoch,
        attestorSigningKeypair: attestorEpoch.keypair,
        subjectEpoch: subjectEpoch.epoch,
        category: "digital_good",
        outcome: "completed_as_agreed",
      },
      NOW,
    );
    expect(attestationResult.ok).toBe(true);

    // Anti-self-dealing / duplicate protections are untouched by this arc --
    // a second attestation for the SAME order+attestor is still refused.
    const duplicate = issueTradeCompletionAttestation(
      { orderRepository, store },
      {
        orderId: "order-2",
        attestorRole: "buyer",
        attestorRealPubkey: BUYER,
        attestorEpoch: attestorEpoch.epoch,
        attestorSigningKeypair: attestorEpoch.keypair,
        subjectEpoch: subjectEpoch.epoch,
        category: "digital_good",
        outcome: "completed_as_agreed",
      },
      NOW,
    );
    expect(duplicate).toEqual({ ok: false, code: "duplicate_attestation", reason: expect.any(String) });

    // Receipt: a truthful "delivery_confirmation" is now genuinely issuable.
    const receiptKeys = { keypair: FedosTrustSigningKeypair.generate(), issuer: "receipt-issuer" };
    const payload: DeliveryReceiptProofPayload = {
      kind: "delivery_confirmation",
      orderId: "order-2",
      productRef: PRODUCT_ID,
      buyerRef: BUYER,
      sellerRef: SELLER,
      deliveryConfirmationRef: `media-release:${MEDIA_ID}:${"a".repeat(64)}`,
      completedAt: NOW,
      formatVersion: 1,
    };
    const guarded = issueSignedDeliveryReceiptProofIfTruthful(payload, attempt.order.status, attempt.invariant, receiptKeys, { issuedAt: NOW });
    expect(guarded.issued).toBe(true);
  });

  it("RECEIPT TRUTHFULNESS: a delivery-confirmation receipt can NEVER be issued for a completed order whose content invariant is not satisfied, even if the caller mistakenly believes the order is complete", () => {
    // Simulates a caller that (incorrectly) believes it can issue a receipt
    // for a "completed" order without re-checking content delivery -- the
    // guarded issuance function refuses regardless.
    const receiptKeys = { keypair: FedosTrustSigningKeypair.generate(), issuer: "receipt-issuer" };
    const payload: DeliveryReceiptProofPayload = {
      kind: "delivery_confirmation",
      orderId: "order-3",
      productRef: PRODUCT_ID,
      buyerRef: BUYER,
      sellerRef: SELLER,
      deliveryConfirmationRef: "media-release:not-real",
      completedAt: NOW,
      formatVersion: 1,
    };
    const invariant: DigitalContentDeliveryInvariantResult = { satisfied: false, reason: "digital-content-not-delivered", missingMediaIds: [MEDIA_ID] };
    const guarded = issueSignedDeliveryReceiptProofIfTruthful(payload, "completed", invariant, receiptKeys, { issuedAt: NOW });
    expect(guarded).toEqual({ issued: false, decision: { permitted: false, reason: "digital-content-not-delivered", missingMediaIds: [MEDIA_ID] } });
  });

  it("RECEIPT TRUTHFULNESS: a plain trade_completion receipt (no delivery claim at all) is unaffected by content-delivery state -- it never asserted delivery in the first place", () => {
    const receiptKeys = { keypair: FedosTrustSigningKeypair.generate(), issuer: "receipt-issuer" };
    const guarded = issueSignedTradeReceiptProofIfTruthful(
      { kind: "trade_completion", orderId: "order-4", productRef: PRODUCT_ID, buyerRef: BUYER, sellerRef: SELLER, completedAt: NOW, formatVersion: 1 },
      "completed",
      receiptKeys,
      { issuedAt: NOW },
    );
    expect(guarded.issued).toBe(true);
  });

  it("RECEIPT TRUTHFULNESS: neither kind is ever issuable for a non-completed order", () => {
    const receiptKeys = { keypair: FedosTrustSigningKeypair.generate(), issuer: "receipt-issuer" };
    const tradeGuarded = issueSignedTradeReceiptProofIfTruthful(
      { kind: "trade_completion", orderId: "order-5", productRef: PRODUCT_ID, buyerRef: BUYER, sellerRef: SELLER, completedAt: NOW, formatVersion: 1 },
      "delivered",
      receiptKeys,
      { issuedAt: NOW },
    );
    expect(tradeGuarded).toEqual({ issued: false, decision: { permitted: false, reason: "order-not-completed" } });
  });
});
