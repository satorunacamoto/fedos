/**
 * Commerce Product-Media Sync + Truthful Completion mega-arc (Agent C) —
 * pure gate deciding whether it would be TRUTHFUL to issue a given
 * `CommerceReceiptProofKind` for a specific Order right now (arc
 * requirement 3: "a signed receipt must never claim 'content successfully
 * delivered' if the evidence only proves Order-completed or
 * seller-claimed-fulfillment").
 *
 * WHY THIS FILE EXISTS, SEPARATE FROM `commerce_trust_receipt_adapter.ts`:
 * `receipt_types.ts`'s own header already documents, deliberately, that a
 * valid signature over a `TradeReceiptProofPayload`/`DeliveryReceiptProofPayload`
 * proves ONLY "the issuer signed these opaque references" — never that the
 * referenced facts are true. `issueSignedTradeReceiptProof()`/
 * `issueSignedDeliveryReceiptProof()` (`commerce_trust_receipt_adapter.ts`)
 * are, BY DESIGN, pure signing functions with zero domain-state lookup —
 * exactly like `../order/order_state_machine.ts`'s own `applyOrderAction()`
 * trusts its caller's `OrderActor`, the truthfulness burden for a receipt
 * sits entirely on WHATEVER CALLS the signer. This file is that check,
 * extracted into its own pure, reusable, independently-testable function —
 * mirroring this repo's pervasive "re-check independently at every layer
 * that can, never trust that an earlier layer already did" discipline (e.g.
 * `evaluateMediaAccessGrant()` re-run inside `wrapMediaAccessGrantRelease()`
 * even though a caller already checked once; delivery evidence's
 * `verification.source` re-checked at runtime even though the type system
 * already constrains it).
 *
 * NO CROSS-TERRITORY IMPORT, same discipline as `receipt_types.ts`/
 * `commerce_trust_receipt_adapter.ts`'s own header: this file imports
 * nothing from `../order/`, `../media_grant/`, `../catalog/`, or
 * `../reputation/`. `orderStatus` and `digitalContentDeliveryInvariant`
 * below are opaque, caller-supplied values — the caller (the composition
 * root, which DOES hold a real `Order` and can re-run
 * `evaluateDigitalContentDeliveryInvariantForOrderCompletion()` itself) is
 * responsible for supplying them from genuinely re-checked, real state, not
 * from a stale cache or an earlier decision taken on trust.
 */

import type { CommerceReceiptProofKind } from "./receipt_types.js";

export type CommerceReceiptTruthfulnessDenialReason = "order-not-completed" | "digital-content-not-delivered" | "product-media-knowledge-unsynced";

export type CommerceReceiptTruthfulnessDecision =
  | { readonly permitted: true }
  | { readonly permitted: false; readonly reason: "order-not-completed" }
  | { readonly permitted: false; readonly reason: "digital-content-not-delivered"; readonly missingMediaIds: readonly string[] }
  | { readonly permitted: false; readonly reason: "product-media-knowledge-unsynced" };

/**
 * Opaque mirror of `../media_grant/media_access_grant_release_channel_policy.ts`'s
 * own `DigitalContentDeliveryInvariantResult` — structurally identical, not
 * imported (see this file's header). A caller passes its own
 * already-computed result straight through.
 */
export type OpaqueDigitalContentDeliveryInvariantResult =
  | { readonly satisfied: true }
  | { readonly satisfied: false; readonly reason: "digital-content-not-delivered"; readonly missingMediaIds: readonly string[] }
  | { readonly satisfied: false; readonly reason: "product-media-knowledge-unsynced" };

export interface EvaluateCommerceReceiptTruthfulnessInput {
  readonly kind: CommerceReceiptProofKind;
  /** Opaque, caller-supplied real `Order.status` — this function trusts nothing about how it was obtained beyond that the caller re-looked it up. */
  readonly orderStatus: string;
  /**
   * Required whenever `kind === "delivery_confirmation"` — the caller's OWN,
   * freshly-computed digital-content-delivery invariant result for this
   * exact Order (never a cached/stale one). Omitted (or ignored) for
   * `kind === "trade_completion"`, which never claims content delivery in
   * the first place (`receipt_types.ts`'s own `TradeReceiptProofPayload`
   * doc: it carries no `deliveryConfirmationRef` at all).
   */
  readonly digitalContentDeliveryInvariant?: OpaqueDigitalContentDeliveryInvariantResult;
}

/**
 * Never throws. `permitted: true` only when:
 *   1. `orderStatus === "completed"` — mirrors
 *      `../reputation/reputation_issuance.ts`'s own Gate #1 exactly (a
 *      receipt for an order that never genuinely completed is never
 *      truthful, regardless of kind).
 *   2. For `kind === "delivery_confirmation"` ONLY: the caller's supplied
 *      `digitalContentDeliveryInvariant` is `satisfied: true`. A
 *      `"trade_completion"` receipt needs no such check — it never claims
 *      delivery.
 * A caller that omits `digitalContentDeliveryInvariant` for a
 * `"delivery_confirmation"` kind is treated as UNKNOWN-therefore-DENIED
 * (`"product-media-knowledge-unsynced"`) — this function fails closed on a
 * missing input, never open.
 */
export function evaluateCommerceReceiptTruthfulness(input: EvaluateCommerceReceiptTruthfulnessInput): CommerceReceiptTruthfulnessDecision {
  if (input.orderStatus !== "completed") {
    return { permitted: false, reason: "order-not-completed" };
  }
  if (input.kind !== "delivery_confirmation") {
    return { permitted: true };
  }
  const invariant = input.digitalContentDeliveryInvariant;
  if (invariant === undefined) {
    return { permitted: false, reason: "product-media-knowledge-unsynced" };
  }
  if (invariant.satisfied) {
    return { permitted: true };
  }
  if (invariant.reason === "digital-content-not-delivered") {
    return { permitted: false, reason: "digital-content-not-delivered", missingMediaIds: invariant.missingMediaIds };
  }
  return { permitted: false, reason: "product-media-knowledge-unsynced" };
}
