/**
 * FedOS Commerce Purchase Completion mega-arc (completion-lag fix round) —
 * the receive-side reconciliation for `PrivateOrderSyncPayload`
 * (`./commerce_private_order_sync.ts`). Pure, synchronous, no I/O — the
 * composition root (`fedos_electron_beta_main.cts`) does the actual
 * lookup/save against its own durable `OrderRepository`; this function only
 * decides WHAT the new `Order` should be, and — the reason this file exists
 * at all — whether the inbound event may be permanently retired from that
 * process's dedup set or MUST stay eligible for re-evaluation on a later
 * bounded refresh.
 *
 * WHY THIS FILE EXISTS (the defect it closes)
 * ----------------------------------------------------------------------
 * This logic previously lived inline in
 * `applyInboundPrivateOrderSyncNonFatal()` and every rejection path was a
 * bare `return`, indistinguishable from every other, while the caller had
 * ALREADY written `envelope.eventId` into its process-lifetime dedup set
 * BEFORE attempting the apply. A live two-process E2E run
 * (`packages/fedos-desktop-electron-spike/test/commerce_e2e_two_process_real_electron.test.ts`,
 * STEP 10) proved the user-visible consequence: a bounded refresh runs its
 * passes in a fixed order (order-sync -> payment-evidence -> delivery-sync),
 * so the buyer's `"completed"` order-sync event is evaluated while the
 * seller's local Order is still `"fulfilling"`; `complete` legally requires
 * `"delivered"`, so the state machine correctly refuses it — and the
 * pre-apply dedup write then made that refusal PERMANENT for the whole
 * process, even though the very next pass in the very same refresh moved
 * the local Order to exactly the `"delivered"` state the refused event
 * needed. The seller stayed stuck at `"delivered"` until the next process
 * launch.
 *
 * The fix is NOT to weaken any guard (every authority check below is the
 * same one that was there before, in the same order) and NOT to drop the
 * dedup set (replay safety must survive). It is to make the outcome
 * TRI-STATE, so the caller can tell the two genuinely different kinds of
 * "no" apart:
 *
 *   - `"applied"`                   -> save it, and retire the event id.
 *   - `"permanently-inapplicable"`  -> retire the event id. This event can
 *                                      NEVER apply to this process, at any
 *                                      future time, no matter what the
 *                                      local state does next: it is
 *                                      malformed, unauthorized, for a
 *                                      different order's economics, or
 *                                      already superseded (the local order
 *                                      has reached or passed the status
 *                                      this event asks for, or is
 *                                      terminal). Re-processing is pure
 *                                      waste, so it is bounded away.
 *   - `"retry-later"`               -> do NOT retire the event id. The
 *                                      event is well-formed and authorized;
 *                                      this process's own local state has
 *                                      simply not caught up yet. It must
 *                                      stay eligible so the SAME event
 *                                      applies on a later refresh in the
 *                                      SAME process.
 *
 * RE-PROCESSING COST OF A `"retry-later"` EVENT (the one thing this change
 * genuinely trades away, sized honestly rather than waved off). Only ONE
 * event class stays eligible indefinitely: a well-formed, fully authorized
 * event naming an `orderId` this process never materializes. Each bounded
 * refresh re-evaluates it at the cost of one `PRIVATE_ORDER_SYNC_STATUS_ACTION`
 * lookup plus one `OrderRepository.findById()` — an O(1) in-memory `Map`
 * read in both the local and the durable repository — and the refresh's own
 * relay query is capped at `COMMERCE_NOSTR_DISCOVERY_EVENT_LIMIT` (500)
 * candidate events, all of which had to be signature-verified and NIP-44
 * decrypted before reaching this function at all. So the added worst case
 * is ~500 map lookups per refresh, strictly less work than the decryption
 * that already preceded them. Every other refusal — including every
 * authority/identity/economics refusal, i.e. everything a hostile sender
 * controls — is retired on FIRST evaluation and never re-examined.
 *
 * REPLAY SAFETY IS UNCHANGED. The dedup set was never the replay authority
 * and still is not: `applyOrderAction()`'s own status guard independently
 * rejects a re-applied transition (`invalid_state`), and a genuine replay
 * of an already-applied event now lands in `"permanently-inapplicable"`
 * (local status has reached/passed the target), which is exactly as safe a
 * no-op as before. The dedup set remains a pure cost optimisation.
 *
 * TRUST BOUNDARY (unchanged, re-stated): `senderPubkeyHex` is the REAL,
 * cryptographically verified signer of the inbound event, never a claim
 * read out of the decrypted payload. Every branch below re-checks it
 * against the party the specific transition authorizes, and the REAL
 * `order_state_machine.ts` re-checks it a third time via
 * `isActorIdentityAuthorized`. A `"retry-later"` outcome is only ever
 * returned for an event that has ALREADY passed every identity/economics
 * check — "not yet" never means "not checked".
 */

import {
  applyOrderAction,
  createOrder,
  isTerminalOrderStatus,
  type Order,
  type OrderAction,
  type OrderStatus,
} from "../order/index.js";
import { PRIVATE_ORDER_SYNC_STATUS_ACTION, type PrivateOrderSyncStatus } from "./commerce_private_order_sync.js";

/** The loosely-typed inbound payload as it comes off the wire bridge — `status` is deliberately a bare `string` here, because deciding whether it is one of the six legal `PrivateOrderSyncStatus` values is this module's own first job. */
export interface InboundPrivateOrderSyncPayload {
  readonly orderId: string;
  readonly productId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly currency: string;
  readonly status: string;
  readonly reason?: string;
  readonly at: number;
}

export interface ApplyInboundPrivateOrderSyncInput {
  /** This process's own already-looked-up `Order` for `payload.orderId`, if one exists yet. `undefined` means "never seen locally before". */
  readonly existingOrder: Order | undefined;
  /** The REAL, cryptographically verified signer of the inbound event — never a claim read out of the decrypted payload. */
  readonly senderPubkeyHex: string;
  readonly payload: InboundPrivateOrderSyncPayload;
}

export type ApplyInboundPrivateOrderSyncOutcome =
  | { readonly outcome: "applied"; readonly order: Order }
  /** Retire the event id: no future local state can ever make this event apply. */
  | { readonly outcome: "permanently-inapplicable"; readonly reason: string }
  /** Keep the event id eligible: well-formed and authorized, but this process's local state has not caught up yet. */
  | { readonly outcome: "retry-later"; readonly reason: string };

/**
 * Position of each `OrderStatus` on the single forward chain
 * `created -> submitted -> accepted -> paid -> fulfilling -> delivered ->
 * completed`. The two off-chain terminal statuses (`rejected`,
 * `cancelled`) are handled by `isTerminalOrderStatus()` BEFORE this table
 * is consulted, so they deliberately have no rank of their own.
 */
const ORDER_STATUS_RANK: Readonly<Record<OrderStatus, number>> = {
  created: 0,
  submitted: 1,
  accepted: 2,
  paid: 3,
  fulfilling: 4,
  delivered: 5,
  completed: 6,
  // Off-chain terminals; never reached via the comparison below.
  rejected: 99,
  cancelled: 99,
};

/**
 * The chain rank a local Order must still be BELOW for a given inbound
 * sync status to have any future chance of applying. Derived directly from
 * `order_state_machine.ts`'s own status guards — the value is the rank of
 * the LATEST local status from which that transition is still legal, plus
 * one:
 *
 *   submit          legal from created(0)                -> 1
 *   cancel          legal from created(0)/submitted(1)   -> 2
 *   accept/reject   legal from submitted(1)              -> 2
 *   fulfill         legal from paid(3)                   -> 4
 *   complete        legal from delivered(5)              -> 6
 *
 * A local Order at or above this rank has already moved past the window in
 * which the event could ever have applied, so the event is superseded
 * forever, not merely early. (`paid`/`delivered` are absent on purpose:
 * `PrivateOrderSyncStatus` deliberately cannot carry them — only a
 * `payment_evidence`/`delivery_evidence` actor may cause those two
 * transitions, on their own separate, narrower channels.)
 */
const PRIVATE_ORDER_SYNC_SUPERSEDED_AT_RANK: Readonly<Record<PrivateOrderSyncStatus, number>> = {
  submitted: 1,
  cancelled: 2,
  accepted: 2,
  rejected: 2,
  fulfilling: 4,
  completed: 6,
};

/**
 * Decides whether an `invalid_state` refusal from `applyOrderAction()` is
 * "too early" (retry on a later refresh) or "too late / already done"
 * (retire forever). This is the whole completion-lag fix in one place.
 */
function invalidStateDisposition(localStatus: OrderStatus, syncStatus: PrivateOrderSyncStatus): "retry-later" | "permanently-inapplicable" {
  // Nothing moves a terminal order again -- no future refresh can help.
  if (isTerminalOrderStatus(localStatus)) return "permanently-inapplicable";
  return ORDER_STATUS_RANK[localStatus] < PRIVATE_ORDER_SYNC_SUPERSEDED_AT_RANK[syncStatus]
    ? "retry-later"
    : "permanently-inapplicable";
}

export function applyInboundPrivateOrderSyncPayload(
  input: ApplyInboundPrivateOrderSyncInput,
): ApplyInboundPrivateOrderSyncOutcome {
  const { payload, senderPubkeyHex } = input;

  const syncStatus = payload.status as PrivateOrderSyncStatus;
  const mapping = PRIVATE_ORDER_SYNC_STATUS_ACTION[syncStatus];
  if (mapping === undefined) {
    // An unknown/unsupported status string can never become known later.
    return { outcome: "permanently-inapplicable", reason: `unsupported private-order sync status "${payload.status}"` };
  }

  let order = input.existingOrder;
  if (order === undefined) {
    if (mapping.action !== "submit") {
      // THE second half of the completion-lag class: an out-of-order event
      // for an order this process has not materialized YET. The submit
      // event that materializes it may still arrive (relay ordering, a
      // `limit`-truncated first page, or simply a later refresh), so this
      // must stay eligible -- never retired.
      return { outcome: "retry-later", reason: "no local order for this orderId yet (out of order)" };
    }
    if (senderPubkeyHex !== payload.buyerPubkey) {
      // Trust boundary: only the real buyer may materialize a new order.
      return { outcome: "permanently-inapplicable", reason: "sender is not this order's buyer" };
    }
    const created = createOrder(
      {
        id: payload.orderId,
        productId: payload.productId,
        sellerPubkey: payload.sellerPubkey,
        unitPriceCents: payload.unitPriceCents,
        currency: payload.currency,
        quantity: payload.quantity,
      },
      { kind: "customer", pubkey: senderPubkeyHex },
      payload.at,
    );
    if (!created.ok || created.order === undefined) {
      // Structurally invalid input (self-dealing, bad economics, ...) --
      // the same bytes will fail identically forever.
      return { outcome: "permanently-inapplicable", reason: created.ok ? "order creation failed unexpectedly" : created.reason };
    }
    order = created.order;
  } else if (
    order.productId !== payload.productId ||
    order.buyerPubkey !== payload.buyerPubkey ||
    order.sellerPubkey !== payload.sellerPubkey ||
    order.unitPriceCents !== payload.unitPriceCents ||
    order.currency !== payload.currency ||
    order.quantity !== payload.quantity
  ) {
    // Defense in depth: a status-sync must never also silently change the
    // order's own established economics. A mismatch against an order this
    // process already holds is permanent -- the local economics are
    // immutable, so no later refresh can reconcile it.
    return { outcome: "permanently-inapplicable", reason: "payload economics do not match the existing local order" };
  }

  const actorKind: "customer" | "merchant" =
    mapping.actorKind === "either" ? (senderPubkeyHex === order.buyerPubkey ? "customer" : "merchant") : mapping.actorKind;
  const expectedPubkey = actorKind === "customer" ? order.buyerPubkey : order.sellerPubkey;
  if (senderPubkeyHex !== expectedPubkey) {
    // Trust boundary: the verified signer is not the party this transition
    // authorizes. Identities on an order never change, so this is final.
    return { outcome: "permanently-inapplicable", reason: `sender is not this order's ${actorKind}` };
  }

  const action: Record<string, unknown> = { type: mapping.action, actor: { kind: actorKind, pubkey: senderPubkeyHex } };
  if ((mapping.action === "reject" || mapping.action === "cancel") && payload.reason !== undefined) action.reason = payload.reason;

  const result = applyOrderAction(order, action as OrderAction, payload.at);
  if (result.ok && result.order !== undefined) return { outcome: "applied", order: result.order };
  if (!result.ok && result.code === "invalid_state") {
    return { outcome: invalidStateDisposition(order.status, syncStatus), reason: result.reason };
  }
  // `unauthorized_actor` / `evidence_mismatch` / `evidence_not_settled` /
  // `invalid_input`: none of these depend on the local status advancing,
  // so none of them can start succeeding later.
  return { outcome: "permanently-inapplicable", reason: result.ok ? "order transition produced no order" : result.reason };
}
