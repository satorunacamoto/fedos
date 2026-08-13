/**
 * Commerce Product-Media Sync + Truthful Completion mega-arc (Agent C) —
 * pure, honest, role-aware UI-state derivation for digital content delivery
 * (arc requirements 6 and 7). Mirrors
 * `../order/cross_process_outcome_text.ts`'s own established convention
 * exactly ("a pure, testable domain-owned mapping from a real outcome to
 * safe user-facing copy; the composition root only renders it") — same
 * discipline, new subject.
 *
 * WHY THIS EXISTS: `../catalog/product_media_types.ts`'s
 * `ProductDeliveryClassification` and
 * `./media_access_grant_release_channel_policy.ts`'s
 * `DigitalContentDeliveryInvariantResult` are both real, tested domain
 * facts — but neither is, by itself, a safe thing to show a user. This file
 * is the ONE place that turns those two facts into a small, closed set of
 * DISPLAY states plus honest, role-appropriate copy and a safe next action,
 * so `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts`
 * (Wave B, Coordinator-wired — this file does not touch that renderer
 * itself, per this arc's own "flag the IPC/UI surface, do not wire it"
 * scope) never needs to re-derive this logic or invent its own copy twice
 * for buyer vs. seller.
 *
 * THE BUYER-FACING REQUIREMENT (arc requirement 6): when required digital
 * content is missing, the buyer must see an honest "delivery incomplete /
 * content not available yet" state — never a plain false "this product has
 * no protected content" message when the real reason is a sync/authorization
 * gap. `"availability-unknown"` below is EXACTLY that distinction, made
 * structurally ready now (so Wave B integration only ever needs to pass the
 * real `productMediaKnowledge` signal into
 * `evaluateDigitalContentDeliveryInvariantForOrderCompletion()` — see that
 * function's own header — to make this state real, without touching this
 * file's copy logic a second time).
 *
 * THE SELLER-FACING REQUIREMENT (arc requirement 7): Bob must not be able
 * to accidentally represent "Delivered" if the protected artifact was never
 * attached/published/released — `"awaiting-seller-release"` below is that
 * state from the seller's own point of view, with copy that tells the
 * seller what is actually missing (attach/publish, or wait for the buyer's
 * device to request it) rather than a bare rejection.
 */

import type { ProductDeliveryClassification } from "../catalog/product_media_types.js";
import type { DigitalContentDeliveryInvariantResult } from "./media_access_grant_release_channel_policy.js";

/**
 * The closed, four-member display vocabulary every consumer of this file
 * renders from. Deliberately coarser than `ProductDeliveryClassification`
 * (which has a `"public-content-only"` member) — for THIS domain's purpose
 * (is there a truthful digital-delivery claim to make about this Order?), a
 * Product with only public media needs no delivery-status UI at all, same
 * as one with no digital media whatsoever; `deriveProductDeliveryClassification()`
 * itself remains the richer, 3-way vocabulary for any OTHER consumer (e.g. a
 * future product-listing badge) that needs the distinction.
 */
export type DigitalContentDeliveryDisplayState = "no-digital-deliverable" | "delivered" | "awaiting-seller-release" | "availability-unknown";

/**
 * Pure derivation. Never throws, total over every real
 * `DigitalContentDeliveryInvariantResult`/`ProductDeliveryClassification`
 * combination this codebase can produce.
 */
export function deriveDigitalContentDeliveryDisplayState(input: {
  readonly classification: ProductDeliveryClassification;
  readonly invariant: DigitalContentDeliveryInvariantResult;
}): DigitalContentDeliveryDisplayState {
  if (input.classification !== "protected-digital-deliverable") return "no-digital-deliverable";
  if (input.invariant.satisfied) return "delivered";
  if (input.invariant.reason === "product-media-knowledge-unsynced") return "availability-unknown";
  return "awaiting-seller-release";
}

export interface DigitalContentDeliveryDisplayCopy {
  /** Short status label — never claims more than the underlying fact proves (this file's own header). */
  readonly headline: string;
  /** One honest sentence of detail. Never blames the buyer/seller for a gap that is actually a sync/authorization limitation. */
  readonly detail: string;
  /** A safe, actionable next step matched to the actual state — arc requirement 6 ("a safe next action (retry sync / wait for seller / view order details) matched to the actual state"). */
  readonly nextAction: string;
}

/** `"no-digital-deliverable"` renders no delivery-status UI at all for either role — an ordinary physical-goods/public-content Order has nothing to say here. */
const EMPTY_COPY: DigitalContentDeliveryDisplayCopy = { headline: "", detail: "", nextAction: "" };

const BUYER_COPY: Readonly<Record<DigitalContentDeliveryDisplayState, DigitalContentDeliveryDisplayCopy>> = {
  "no-digital-deliverable": EMPTY_COPY,
  delivered: {
    headline: "Content delivered",
    detail: "You have received and this device has independently verified this product's protected content.",
    nextAction: "View order details",
  },
  "awaiting-seller-release": {
    headline: "Delivery incomplete",
    detail: "This product has protected content that has not yet been released to you.",
    nextAction: "Wait for the seller, or retry sync",
  },
  "availability-unknown": {
    headline: "Content not available yet",
    detail: "This device can't yet confirm whether this product's protected content has been released to you. This is NOT the same as the product having no protected content.",
    nextAction: "Retry sync",
  },
};

const SELLER_COPY: Readonly<Record<DigitalContentDeliveryDisplayState, DigitalContentDeliveryDisplayCopy>> = {
  "no-digital-deliverable": EMPTY_COPY,
  delivered: {
    headline: "Delivered",
    detail: "Every protected media item for this product has been released to, and digest-verified by, this order's buyer.",
    nextAction: "View order details",
  },
  "awaiting-seller-release": {
    headline: "Not yet delivered",
    detail: "This product has protected content that has not been released to this order's buyer yet.",
    nextAction: "Review attached content, or wait for the buyer's device to request it",
  },
  "availability-unknown": {
    headline: "Delivery status unknown",
    detail: "This process can't yet confirm delivery status for this order.",
    nextAction: "Retry sync",
  },
};

/**
 * Role-aware, honest copy for a `DigitalContentDeliveryDisplayState`. Never
 * claims "Delivered" (or any variant of it) unless `state === "delivered"`,
 * and never collapses `"availability-unknown"` into either
 * `"no-digital-deliverable"` or `"awaiting-seller-release"` — see this
 * file's own header for exactly why that third state exists.
 */
export function describeDigitalContentDeliveryDisplayState(
  state: DigitalContentDeliveryDisplayState,
  role: "buyer" | "seller",
): DigitalContentDeliveryDisplayCopy {
  return (role === "buyer" ? BUYER_COPY : SELLER_COPY)[state];
}
