/**
 * FedOS Commerce Purchase Completion mega-arc (Agent D) — the receive-side
 * reconciliation for `PrivateDeliverySyncPayload`
 * (`./commerce_private_delivery_sync.ts`). Pure, synchronous, no I/O — the
 * composition root (`fedos_electron_beta_main.cts`) does the actual
 * lookup/save against its own durable `DeliveryRepository`; this function
 * only decides WHAT the new `DeliveryRecord` should be, exactly the same
 * "pure orchestration, testable in isolation" split this arc's own
 * `../media_grant/media_access_grant_issuance.ts` already established.
 *
 * TRUST BOUNDARY (re-checked here even though the bridge that decrypted
 * this payload already verified the outer Nostr event's signature — same
 * "defense in depth, never trust a lower layer's verification alone"
 * posture `applyInboundPrivateOrderSyncNonFatal()`
 * (`fedos_electron_beta_main.cts`) already documents for `Order`): every
 * branch below independently re-checks that `senderPubkeyHex` — the REAL,
 * cryptographically verified signer of the inbound event, never a claim
 * read out of the decrypted payload itself — is the party this specific
 * action actually authorizes. This is the concrete mechanism behind this
 * arc's own requirement *"Seller must NOT be able to manufacture Buyer
 * acknowledgment"*: a `"recipient_acknowledged"` payload is honored ONLY
 * when `senderPubkeyHex === delivery.buyerPubkey`; nothing a seller's own
 * process sends can ever satisfy that check for itself.
 *
 * REPLAY SAFETY: every branch delegates the actual transition to the REAL
 * `../delivery/delivery_state_machine.ts` functions
 * (`createDelivery()`/`applyDeliveryAction()`), never re-implements their
 * guards. Re-applying an already-applied action (a duplicated/replayed
 * wire event, or a bounded-refresh re-scan of an already-processed one) is
 * therefore a safe, side-effect-free `"no-op"` outcome — the state
 * machine's own status guard rejects the second application before it
 * ever mutates anything or re-derives `DeliveryReceiptArtifact` a second
 * time (see `delivery_state_machine.ts`'s own "Idempotent on duplicate
 * evidence" doc for `confirm_delivery`).
 */

import { applyDeliveryAction, createDelivery, type DeliveryEvidence, type DeliveryRecord, type DeliveryStatus } from "../delivery/index.js";
import type { PrivateDeliverySyncPayload } from "./commerce_private_delivery_sync.js";

export interface ApplyInboundPrivateDeliverySyncInput {
  /** This process's own already-looked-up `DeliveryRecord` for `payload.orderId`, if one exists yet. `undefined` means "never seen locally before". */
  readonly existingDelivery: DeliveryRecord | undefined;
  /**
   * Whether THIS process's own, independently-tracked Order record for
   * `payload.orderId` is already in a qualifying (paid-or-later) status —
   * the caller's own responsibility to derive (e.g. via
   * `isQualifyingOrderStatusForMediaAccess(localOrder.status)`), never
   * trusted from the wire payload itself. Required before this function
   * will ever materialize a brand-new `DeliveryRecord` on a `"fulfilling"`
   * action for a `deliveryId` this process has never seen — mirrors
   * `CreateDeliveryInput.orderPaymentConfirmed`'s own "caller must assert
   * a precondition this module cannot independently verify" discipline.
   */
  readonly orderPaymentConfirmed: boolean;
  /** The REAL, cryptographically verified signer of the inbound event — never a claim read out of the decrypted payload. */
  readonly senderPubkeyHex: string;
  readonly payload: PrivateDeliverySyncPayload;
}

/**
 * `retryable` (completion-lag fix round): whether the CALLER's own
 * process-lifetime dedup set may permanently retire this event id.
 *
 *   `retryable: false` -> retire it. No future local state can make this
 *                        event apply: it is malformed, unauthorized, for a
 *                        different record's identity, or already
 *                        superseded (this process's Delivery has reached
 *                        or passed the status the event asks for).
 *   `retryable: true`  -> KEEP it eligible. The event is well-formed and
 *                        authorized; this process's own local state has
 *                        simply not caught up yet (e.g. a buyer's
 *                        `"recipient_acknowledged"` arriving before the
 *                        seller's `"fulfilling"` has been applied, or
 *                        before the local Order has reached a
 *                        payment-confirmed status). It MUST stay eligible
 *                        so the SAME event applies on a later refresh in
 *                        the SAME process.
 *
 * This exists because the caller previously wrote the event id into its
 * dedup set BEFORE attempting the apply, which turned every "not yet" into
 * a permanent drop for the whole process lifetime — see
 * `./commerce_private_order_apply.ts`'s header for the live two-process
 * E2E run that proved the consequence on the Order channel. Replay safety
 * is unchanged: the dedup set was never the replay authority, the real
 * `delivery_state_machine.ts` status guards still are, and a genuine
 * replay of an already-applied event is `retryable: false` (superseded),
 * exactly as safe a no-op as before.
 */
export type ApplyInboundPrivateDeliverySyncOutcome =
  | { readonly outcome: "applied"; readonly delivery: DeliveryRecord }
  | { readonly outcome: "no-op"; readonly retryable: boolean }
  | { readonly outcome: "rejected"; readonly reason: string; readonly retryable: boolean };

/**
 * Position of each `DeliveryStatus` on the single forward chain
 * `pending -> fulfilling -> delivered -> completed`.
 */
const DELIVERY_STATUS_RANK: Readonly<Record<DeliveryStatus, number>> = {
  pending: 0,
  fulfilling: 1,
  delivered: 2,
  completed: 3,
};

/**
 * The chain rank a local Delivery must still be BELOW for a given inbound
 * sync action to have any future chance of applying — derived directly
 * from `delivery_state_machine.ts`'s own status guards (the rank of the
 * latest local status from which the transition is still legal, plus one):
 *
 *   fulfilling               `start_fulfillment` legal from pending(0)   -> 1
 *   recipient_acknowledged   `confirm_delivery`  legal from fulfilling(1) -> 2
 *   completed                `acknowledge`       legal from delivered(2)  -> 3
 */
const DELIVERY_SYNC_SUPERSEDED_AT_RANK: Readonly<Record<PrivateDeliverySyncPayload["action"], number>> = {
  fulfilling: 1,
  recipient_acknowledged: 2,
  completed: 3,
};

/** Is a state-machine refusal for `action` against a local Delivery at `status` "too early" (retry later) or "already past it" (retire forever)? */
function isRetryableForStatus(status: DeliveryStatus, action: PrivateDeliverySyncPayload["action"]): boolean {
  return DELIVERY_STATUS_RANK[status] < DELIVERY_SYNC_SUPERSEDED_AT_RANK[action];
}

export function applyInboundPrivateDeliverySyncPayload(
  input: ApplyInboundPrivateDeliverySyncInput,
): ApplyInboundPrivateDeliverySyncOutcome {
  const { payload, senderPubkeyHex } = input;
  let delivery = input.existingDelivery;

  // Defense in depth (mirrors `applyInboundPrivateOrderSyncNonFatal()`'s own
  // "a status-sync must never also silently change the order's own
  // established economics"): a sync payload for an already-known delivery
  // must never smuggle in a different orderId/buyer/seller than the record
  // this process already holds.
  if (
    delivery !== undefined &&
    (delivery.orderId !== payload.orderId || delivery.buyerPubkey !== payload.buyerPubkey || delivery.sellerPubkey !== payload.sellerPubkey)
  ) {
    // The local record's own identity fields never change, so a mismatch
    // can never reconcile itself on a later refresh.
    return { outcome: "rejected", reason: "payload does not match the existing local delivery record", retryable: false };
  }

  if (payload.action === "fulfilling") {
    if (delivery === undefined) {
      if (senderPubkeyHex !== payload.sellerPubkey) {
        return { outcome: "rejected", reason: "sender is not this delivery's seller", retryable: false };
      }
      const created = createDelivery(
        {
          id: payload.deliveryId,
          orderId: payload.orderId,
          buyerPubkey: payload.buyerPubkey,
          sellerPubkey: payload.sellerPubkey,
          orderPaymentConfirmed: input.orderPaymentConfirmed,
        },
        { kind: "merchant", pubkey: senderPubkeyHex },
        payload.at,
      );
      if (!created.ok || created.delivery === undefined) {
        // `order_not_paid` is the ONE creation refusal that is purely a
        // local-state race: this process's own Order simply has not
        // reached a payment-confirmed status YET (the caller derives
        // `orderPaymentConfirmed` from it), and a later refresh -- e.g.
        // after the payment-evidence pass runs -- can legitimately accept
        // the very same event. Every other code is structural and final.
        const retryable = !created.ok && created.code === "order_not_paid";
        return { outcome: "rejected", reason: created.ok ? "delivery creation failed unexpectedly" : created.reason, retryable };
      }
      delivery = created.delivery;
    }
    if (senderPubkeyHex !== delivery.sellerPubkey) {
      return { outcome: "rejected", reason: "sender is not this delivery's seller", retryable: false };
    }
    const started = applyDeliveryAction(
      delivery,
      {
        type: "start_fulfillment",
        actor: { kind: "merchant", pubkey: senderPubkeyHex },
        claim: { deliveryId: delivery.id, orderId: delivery.orderId, claimedAt: payload.at, ...(payload.reason !== undefined ? { note: payload.reason } : {}) },
      },
      payload.at,
    );
    if (!started.ok) {
      // Out-of-order/replayed (e.g. already "fulfilling" or later) -- safe
      // no-op. If this call freshly materialized the record above, the
      // record itself is still a real, newly-applied fact even though the
      // fulfillment claim on top of it didn't advance further.
      return delivery !== input.existingDelivery
        ? { outcome: "applied", delivery }
        : { outcome: "no-op", retryable: isRetryableForStatus(delivery.status, payload.action) };
    }
    return { outcome: "applied", delivery: started.delivery };
  }

  if (payload.action === "recipient_acknowledged") {
    if (delivery === undefined) {
      // Out of order, NOT invalid: the seller's own `"fulfilling"` event
      // (which materializes the record) may still arrive on a later
      // bounded refresh, so this event must stay eligible.
      return { outcome: "rejected", reason: "no local delivery record for this order yet (out of order)", retryable: true };
    }
    if (senderPubkeyHex !== delivery.buyerPubkey) {
      // THE concrete enforcement of "Seller must NOT be able to manufacture
      // Buyer acknowledgment" -- see this file's own header.
      return { outcome: "rejected", reason: "sender is not this delivery's buyer", retryable: false };
    }
    const evidence: DeliveryEvidence = {
      deliveryId: delivery.id,
      orderId: delivery.orderId,
      status: "delivered",
      observedAt: payload.at,
      reason: payload.reason ?? "customer acknowledged receipt",
      // Reconstructed HERE from the verified sender identity -- never
      // deserialized from the wire payload, which structurally carries no
      // `verification`/`authoritative` field at all (see
      // `commerce_private_delivery_sync.ts`'s own header).
      verification: { source: "recipient_acknowledgment", authoritative: true, acknowledgedBy: senderPubkeyHex },
    };
    const result = applyDeliveryAction(delivery, { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence }, payload.at);
    // A refusal while the record is still `"pending"` is a pure ordering
    // race (the seller's `"fulfilling"` has not been applied yet); a
    // refusal at `"delivered"`/`"completed"` is a genuine replay.
    if (!result.ok) return { outcome: "no-op", retryable: isRetryableForStatus(delivery.status, payload.action) };
    return { outcome: "applied", delivery: result.delivery };
  }

  // payload.action === "completed"
  if (delivery === undefined) {
    return { outcome: "rejected", reason: "no local delivery record for this order yet (out of order)", retryable: true };
  }
  const actorKind: "customer" | "merchant" | undefined =
    senderPubkeyHex === delivery.buyerPubkey ? "customer" : senderPubkeyHex === delivery.sellerPubkey ? "merchant" : undefined;
  if (actorKind === undefined) {
    return { outcome: "rejected", reason: "sender is neither this delivery's buyer nor seller", retryable: false };
  }
  const result = applyDeliveryAction(delivery, { type: "acknowledge", actor: { kind: actorKind, pubkey: senderPubkeyHex } }, payload.at);
  // Same discipline: refused because the record has not reached
  // `"delivered"` yet (retry) vs. because it is already `"completed"`
  // (retire).
  if (!result.ok) return { outcome: "no-op", retryable: isRetryableForStatus(delivery.status, payload.action) };
  return { outcome: "applied", delivery: result.delivery };
}
