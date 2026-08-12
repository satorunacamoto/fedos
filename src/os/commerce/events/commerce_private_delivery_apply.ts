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

import { applyDeliveryAction, createDelivery, type DeliveryEvidence, type DeliveryRecord } from "../delivery/index.js";
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

export type ApplyInboundPrivateDeliverySyncOutcome =
  | { readonly outcome: "applied"; readonly delivery: DeliveryRecord }
  | { readonly outcome: "no-op" }
  | { readonly outcome: "rejected"; readonly reason: string };

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
    return { outcome: "rejected", reason: "payload does not match the existing local delivery record" };
  }

  if (payload.action === "fulfilling") {
    if (delivery === undefined) {
      if (senderPubkeyHex !== payload.sellerPubkey) {
        return { outcome: "rejected", reason: "sender is not this delivery's seller" };
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
        return { outcome: "rejected", reason: created.ok ? "delivery creation failed unexpectedly" : created.reason };
      }
      delivery = created.delivery;
    }
    if (senderPubkeyHex !== delivery.sellerPubkey) {
      return { outcome: "rejected", reason: "sender is not this delivery's seller" };
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
      return delivery !== input.existingDelivery ? { outcome: "applied", delivery } : { outcome: "no-op" };
    }
    return { outcome: "applied", delivery: started.delivery };
  }

  if (payload.action === "recipient_acknowledged") {
    if (delivery === undefined) {
      return { outcome: "rejected", reason: "no local delivery record for this order yet (out of order)" };
    }
    if (senderPubkeyHex !== delivery.buyerPubkey) {
      // THE concrete enforcement of "Seller must NOT be able to manufacture
      // Buyer acknowledgment" -- see this file's own header.
      return { outcome: "rejected", reason: "sender is not this delivery's buyer" };
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
    if (!result.ok) return { outcome: "no-op" };
    return { outcome: "applied", delivery: result.delivery };
  }

  // payload.action === "completed"
  if (delivery === undefined) {
    return { outcome: "rejected", reason: "no local delivery record for this order yet (out of order)" };
  }
  const actorKind: "customer" | "merchant" | undefined =
    senderPubkeyHex === delivery.buyerPubkey ? "customer" : senderPubkeyHex === delivery.sellerPubkey ? "merchant" : undefined;
  if (actorKind === undefined) {
    return { outcome: "rejected", reason: "sender is neither this delivery's buyer nor seller" };
  }
  const result = applyDeliveryAction(delivery, { type: "acknowledge", actor: { kind: actorKind, pubkey: senderPubkeyHex } }, payload.at);
  if (!result.ok) return { outcome: "no-op" };
  return { outcome: "applied", delivery: result.delivery };
}
