/**
 * FedOS Commerce End-to-End Completion arc (Agent D, Wave B) — Delivery
 * domain, the guarded transition function(s). Companion to
 * `delivery_types.ts` (shapes) and `delivery_artifact.ts` (the real digital
 * artifact this domain produces).
 *
 * DELIVERY EVIDENCE DISCIPLINE (read this before wiring this module's
 * output into `order/order_state_machine.ts`'s `confirm_delivery`):
 *   - This module NEVER imports `src/os/commerce/order/` or
 *     `src/os/commerce/payment/`. It treats both Order and Payment as
 *     opaque — an `orderId: string` and an explicit
 *     `CreateDeliveryInput.orderPaymentConfirmed: boolean` precondition the
 *     CALLER must assert (see `delivery_types.ts`'s doc on that field for
 *     why this is the correct place to model "delivery before paid must be
 *     impossible" given this module cannot read Order's real state).
 *   - The only way a Delivery can reach `"delivered"` is
 *     `applyDeliveryAction(delivery, { type: "confirm_delivery", actor: {
 *     kind: "delivery_evidence" }, evidence })` where `evidence.verification`
 *     is present, its `source` is in `AUTHORITATIVE_DELIVERY_EVIDENCE_SOURCES`,
 *     AND `verification.authoritative === true`. This is checked in TWO
 *     independent places, mirroring `payment/state_machine.ts`'s own
 *     documented double-check discipline:
 *       1. STRUCTURAL: the actor's `kind` MUST be exactly
 *          `"delivery_evidence"` — a `"merchant"`/`"customer"` actor is
 *          REJECTED before evidence is even inspected, even if it supplies
 *          a perfectly well-formed `evidence` payload with authoritative-
 *          looking `verification`. This makes "merchant self-asserts
 *          DELIVERED with no evidence" structurally impossible, not just
 *          policy-denied.
 *       2. RUNTIME: even given a `"delivery_evidence"` actor, the
 *          evidence's OWN `verification.source`/`.authoritative` are
 *          re-checked against `AUTHORITATIVE_DELIVERY_EVIDENCE_SOURCES` —
 *          never trusted from the type system alone, since a caller could
 *          force a value through with an unsafe cast. Evidence carrying
 *          `verification: { source: "merchant_claim", authoritative: false
 *          }` — i.e. a bare merchant claim laundered through the evidence
 *          shape — is REJECTED here too (`evidence_not_authoritative`).
 *   - WHO is allowed to construct a `{ kind: "delivery_evidence" }` actor
 *     is this module's whole security boundary and is NOT enforced here —
 *     same posture as `order_state_machine.ts` documents for
 *     `"payment_evidence"`: it is the coordinator's integration-gate
 *     responsibility to ensure only a genuinely verified path (today: a
 *     real `recipient_acknowledgment` UI action; future: Agent T's
 *     `signed_proof` output) ever constructs one.
 *   - `evidence.status === "failed"` is accepted as valid input (a caller
 *     can report it without the call being an error) but causes no
 *     transition — mirrors `order_state_machine.ts`'s own documented gap
 *     for `OrderDeliveryEvidence.status === "failed"`. No failure/retry
 *     state exists in `DeliveryStatus` (see that file's doc).
 *   - Idempotent on duplicate evidence: re-applying `"delivered"` evidence
 *     for the SAME `deliveryId`/`evidenceSource` combination while already
 *     `"delivered"` is accepted as a no-op success, not a repeated
 *     transition (mirrors Payment/Order's own duplicate-callback handling).
 *     Evidence for the wrong `deliveryId`/`orderId` is rejected
 *     (`evidence_mismatch`).
 */

import { buildDeliveryReceiptArtifact } from "./delivery_artifact.js";
import type {
  CreateDeliveryInput,
  DeliveryAction,
  DeliveryActionType,
  DeliveryActor,
  DeliveryActorKind,
  DeliveryEvidence,
  DeliveryRecord,
  DeliveryRejectionCode,
  DeliveryStatus,
  DeliveryTransitionRecord,
  DeliveryTransitionResult,
  MerchantDeliveryClaim,
} from "./delivery_types.js";
import { AUTHORITATIVE_DELIVERY_EVIDENCE_SOURCES } from "./delivery_types.js";

function ok(delivery: DeliveryRecord): DeliveryTransitionResult {
  return { ok: true, delivery };
}

function fail(code: DeliveryRejectionCode, reason: string): DeliveryTransitionResult {
  return { ok: false, code, reason };
}

function appendHistory(
  delivery: DeliveryRecord,
  to: DeliveryStatus,
  action: DeliveryActionType,
  actorKind: DeliveryActorKind,
  at: number,
  reason?: string,
): readonly DeliveryTransitionRecord[] {
  const record: DeliveryTransitionRecord = {
    from: delivery.status,
    to,
    action,
    actorKind,
    at,
    ...(reason !== undefined ? { reason } : {}),
  };
  return [...delivery.history, record];
}

/**
 * Which `DeliveryActorKind` may even ATTEMPT each action, independent of
 * the record's current status. Checked FIRST, before any state/identity/
 * evidence check — mirrors `order_state_machine.ts`'s
 * `AUTHORIZED_ACTOR_KINDS`. This is the structural half of "a bare claim
 * must never cause a delivered transition": even if an action is otherwise
 * perfectly timed, the wrong actor kind is rejected before anything else
 * is evaluated.
 */
const AUTHORIZED_ACTOR_KINDS: Readonly<Record<DeliveryActionType, readonly DeliveryActorKind[]>> = {
  start_fulfillment: ["merchant"],
  confirm_delivery: ["delivery_evidence"],
  acknowledge: ["customer", "merchant"],
};

function isActorKindAuthorized(action: DeliveryActionType, actorKind: DeliveryActorKind): boolean {
  return AUTHORIZED_ACTOR_KINDS[action].includes(actorKind);
}

/** True when a `"merchant"`/`"customer"` actor's pubkey matches the record's corresponding party. The evidence-kind actor has no identity to check (authorized by kind alone). */
function isActorIdentityAuthorized(delivery: DeliveryRecord, actor: DeliveryActor): boolean {
  if (actor.kind === "merchant") return actor.pubkey === delivery.sellerPubkey;
  if (actor.kind === "customer") return actor.pubkey === delivery.buyerPubkey;
  return true;
}

/**
 * Creates a new Delivery record in `"pending"` status. The only
 * constructor — there is no way to construct a `DeliveryRecord` object
 * directly outside this function (mirrors `order_state_machine.ts`'s
 * `createOrder()`). REQUIRES `input.orderPaymentConfirmed === true` — this
 * is the explicit precondition parameter enforcing "delivery before paid
 * must be impossible" (see this file's module doc and
 * `delivery_types.ts`'s `CreateDeliveryInput` doc).
 */
export function createDelivery(input: CreateDeliveryInput, actor: DeliveryActor, now: number): DeliveryTransitionResult {
  if (actor.kind !== "merchant" || actor.pubkey === undefined || actor.pubkey.length === 0) {
    return fail("unauthorized_actor", "only a merchant may open a delivery record");
  }
  if (input.id.length === 0) return fail("invalid_input", "id must be non-empty");
  if (input.orderId.length === 0) return fail("invalid_input", "orderId must be non-empty");
  if (input.buyerPubkey.length === 0) return fail("invalid_input", "buyerPubkey must be non-empty");
  if (actor.pubkey !== input.sellerPubkey) {
    return fail("unauthorized_actor", "actor pubkey does not match sellerPubkey");
  }
  if (input.orderPaymentConfirmed !== true) {
    return fail("order_not_paid", "a delivery record may only be created for an order the caller asserts is paid");
  }

  const delivery: DeliveryRecord = {
    id: input.id,
    orderId: input.orderId,
    buyerPubkey: input.buyerPubkey,
    sellerPubkey: input.sellerPubkey,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    history: [{ from: null, to: "pending", action: "create", actorKind: "merchant", at: now }],
  };
  return ok(delivery);
}

function transitionStartFulfillment(
  delivery: DeliveryRecord,
  actor: DeliveryActor,
  now: number,
  claim: MerchantDeliveryClaim,
): DeliveryTransitionResult {
  if (claim.deliveryId !== delivery.id) {
    return fail("evidence_mismatch", "claim deliveryId does not match this delivery");
  }
  if (claim.orderId !== delivery.orderId) {
    return fail("evidence_mismatch", "claim orderId does not match this delivery's order");
  }
  if (delivery.status !== "pending") {
    return fail("invalid_state", `cannot start fulfillment from status "${delivery.status}"`);
  }
  return ok({
    ...delivery,
    status: "fulfilling",
    updatedAt: now,
    history: appendHistory(delivery, "fulfilling", "start_fulfillment", actor.kind, now, claim.note),
  });
}

/**
 * True only for evidence this state machine may ever act on. Re-checks
 * BOTH `verification.source` (against the exported allowlist) AND
 * `verification.authoritative` independently — see this file's module doc
 * for why both are checked rather than trusting either alone.
 */
function isAuthoritativeEvidence(evidence: DeliveryEvidence): boolean {
  const verification = evidence.verification;
  if (verification === undefined) return false;
  return AUTHORITATIVE_DELIVERY_EVIDENCE_SOURCES.has(verification.source) && verification.authoritative === true;
}

function transitionConfirmDelivery(
  delivery: DeliveryRecord,
  actor: DeliveryActor,
  now: number,
  evidence: DeliveryEvidence,
): DeliveryTransitionResult {
  if (evidence.deliveryId !== delivery.id) {
    return fail("evidence_mismatch", "delivery evidence deliveryId does not match this delivery");
  }
  if (evidence.orderId !== delivery.orderId) {
    return fail("evidence_mismatch", "delivery evidence orderId does not match this delivery's order");
  }
  if (delivery.status === "delivered") {
    // Idempotency (mirrors Payment/Order's own duplicate-evidence handling):
    // a repeat "delivered" event from the SAME authoritative source is a
    // no-op success, not a repeated transition. A DIFFERENT source while
    // already delivered is treated as a mismatch, not silently accepted.
    if (evidence.status === "delivered" && evidence.verification?.source === delivery.evidenceSource) {
      return ok(delivery);
    }
    return fail("evidence_mismatch", "delivery is already delivered via a different evidence source");
  }
  if (delivery.status !== "fulfilling") {
    return fail("invalid_state", `cannot confirm delivery from status "${delivery.status}"`);
  }
  if (evidence.status !== "delivered") {
    // "failed" evidence is valid input but causes no transition -- see module doc.
    return fail("evidence_not_authoritative", `delivery evidence status "${evidence.status}" does not confirm delivery`);
  }
  if (!isAuthoritativeEvidence(evidence)) {
    const source = evidence.verification?.source ?? "(none)";
    return fail(
      "evidence_not_authoritative",
      `evidence is not authoritative (verification.source: ${source}) -- a bare merchant claim can never confirm delivery`,
    );
  }

  const evidenceSource = evidence.verification?.source;
  const artifact = buildDeliveryReceiptArtifact({
    deliveryId: delivery.id,
    orderId: delivery.orderId,
    deliveredAt: now,
    // `isAuthoritativeEvidence` above guarantees `evidence.verification` is defined here.
    evidenceSource: evidenceSource as NonNullable<typeof evidenceSource>,
    reason: evidence.reason,
    generatedAt: now,
  });

  return ok({
    ...delivery,
    status: "delivered",
    evidenceSource,
    artifact,
    updatedAt: now,
    history: appendHistory(delivery, "delivered", "confirm_delivery", actor.kind, now, evidence.reason),
  });
}

function transitionAcknowledge(delivery: DeliveryRecord, actor: DeliveryActor, now: number): DeliveryTransitionResult {
  if (delivery.status !== "delivered") {
    return fail("invalid_state", `cannot acknowledge/complete from status "${delivery.status}"`);
  }
  return ok({
    ...delivery,
    status: "completed",
    updatedAt: now,
    history: appendHistory(delivery, "completed", "acknowledge", actor.kind, now),
  });
}

/**
 * Applies one authorized `DeliveryAction` to an existing `DeliveryRecord`,
 * returning either the new record or a rejection — NEVER throws, NEVER
 * mutates `delivery`. Authority is checked in a fixed order for every
 * action, mirroring `order_state_machine.ts`'s `applyOrderAction`:
 *   1. Is this actor KIND even allowed to attempt this action at all
 *      (`AUTHORIZED_ACTOR_KINDS`)? Makes a bare merchant "I delivered it"
 *      claim structurally impossible to accept, regardless of timing.
 *   2. For a `"merchant"`/`"customer"` actor, does its `pubkey` match the
 *      record's corresponding party?
 *   3. Is the CURRENT status legal for this action?
 *   4. (evidence/claim-carrying actions only) Does the payload's own id
 *      binding / authoritativeness support the transition?
 */
export function applyDeliveryAction(delivery: DeliveryRecord, action: DeliveryAction, now: number): DeliveryTransitionResult {
  if (!isActorKindAuthorized(action.type, action.actor.kind)) {
    return fail(
      "unauthorized_actor",
      `actor kind "${action.actor.kind}" is not authorized to perform "${action.type}"`,
    );
  }
  if (!isActorIdentityAuthorized(delivery, action.actor)) {
    return fail("unauthorized_actor", `actor pubkey does not match the delivery's ${action.actor.kind}`);
  }

  switch (action.type) {
    case "start_fulfillment":
      return transitionStartFulfillment(delivery, action.actor, now, action.claim);
    case "confirm_delivery":
      return transitionConfirmDelivery(delivery, action.actor, now, action.evidence);
    case "acknowledge":
      return transitionAcknowledge(delivery, action.actor, now);
  }
}

/**
 * Which `DeliveryActionType`s are legal to attempt RIGHT NOW for a given
 * record + actor kind — mirrors `order_state_machine.ts`'s
 * `getAvailableActions` (a display helper, not itself an authority
 * decision: identity/evidence details are not evaluated).
 */
export function getAvailableDeliveryActions(delivery: DeliveryRecord, actorKind: DeliveryActorKind): readonly DeliveryActionType[] {
  const candidates: DeliveryActionType[] = ["start_fulfillment", "confirm_delivery", "acknowledge"];
  return candidates.filter((type) => {
    if (!isActorKindAuthorized(type, actorKind)) return false;
    switch (type) {
      case "start_fulfillment":
        return delivery.status === "pending";
      case "confirm_delivery":
        return delivery.status === "fulfilling";
      case "acknowledge":
        return delivery.status === "delivered";
    }
  });
}

export function isTerminalDeliveryStatus(status: DeliveryStatus): boolean {
  return status === "completed";
}
