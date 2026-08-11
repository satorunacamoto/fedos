/**
 * FedOS Commerce End-to-End Completion arc (Agent O) — Order domain, types.
 *
 * Closes Gap #3 of `docs/commerce/COMMERCE-GAP-CLASSIFICATION.md`: *"No
 * Order concept exists anywhere in the codebase."* Everything in this file
 * is data shapes only — the guarded transition function lives in
 * `order_state_machine.ts`.
 *
 * DESIGN NOTE — why these nine `OrderStatus` values and no others:
 *   CREATED    — the customer has built the order (product/quantity/price
 *                snapshot) but has not sent it to the merchant yet. Needed
 *                so a customer can review before submitting (the brief's
 *                own UX flow: "Product Detail -> Create Order -> Review ->
 *                Submit") and so `cancel` has a pre-submission state to
 *                act on.
 *   SUBMITTED  — sent to the merchant, awaiting accept/reject. Distinct
 *                from CREATED because the merchant's Incoming Orders list
 *                must only ever show orders actually sent to them, never a
 *                customer's private drafts.
 *   ACCEPTED   — the merchant agreed to fulfill. Deliberately doubles as
 *                "awaiting payment": no customer/merchant action exists
 *                between "merchant said yes" and "payment evidence
 *                arrives" that would need its own state, so a separate
 *                AWAITING_PAYMENT status (suggested as optional by the
 *                brief) was evaluated and DROPPED — it would have had no
 *                transition of its own, only renamed ACCEPTED.
 *   REJECTED   — terminal. The merchant's symmetric "no" to ACCEPTED.
 *   PAID       — set ONLY by verified payment evidence (see
 *                `OrderActorKind`/`order_state_machine.ts`), never by a
 *                bare customer/merchant claim. Kept distinct from ACCEPTED
 *                because it is gated by a completely different authority.
 *   FULFILLING — the merchant has started fulfillment. A hook Agent
 *                D/Wave B completes with real delivery mechanics; this
 *                arc only defines the seam (the `fulfill` action and this
 *                status).
 *   DELIVERED  — set ONLY by delivery evidence (mirrors the payment-evidence
 *                discipline — see `order_state_machine.ts`'s module doc),
 *                never by a bare merchant "I shipped it" claim. Real
 *                verification is Agent D's Wave B responsibility; this arc
 *                defines only the authority seam and placeholder shape.
 *   COMPLETED  — terminal closure once delivery is confirmed. Distinct
 *                from DELIVERED because closing the order (no further
 *                action possible) is a separate event from the delivery
 *                mechanism itself confirming receipt — e.g. a future
 *                dispute window could sit between the two. No money-moving
 *                risk exists at this step, so either party may close it.
 *   CANCELLED  — terminal side branch. Customer-only, and ONLY reachable
 *                from CREATED/SUBMITTED (i.e. strictly before ACCEPTED),
 *                per the brief's explicit policy: "cancel (only when
 *                policy permits, e.g. before ACCEPTED)". Post-accept
 *                abandonment (merchant can no longer fulfill after
 *                accepting) is explicitly OUT OF SCOPE for this arc — see
 *                the final report's PARTIAL/BLOCKED notes.
 *
 * STATUS: real, tested domain code — not reachable from the shipped
 * Electron app until the coordinator wires it in (same posture as the
 * rest of `os/commerce` pre-Phase-1).
 */

/** The Order's own lifecycle. See this file's module doc for why each value exists. */
export type OrderStatus =
  | "created"
  | "submitted"
  | "accepted"
  | "rejected"
  | "paid"
  | "fulfilling"
  | "delivered"
  | "completed"
  | "cancelled";

/** Every `OrderStatus` value, in a sensible display/reference order. */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  "created",
  "submitted",
  "accepted",
  "rejected",
  "paid",
  "fulfilling",
  "delivered",
  "completed",
  "cancelled",
];

/** `OrderStatus` values from which no further transition is ever legal. */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ["rejected", "completed", "cancelled"];

/**
 * PLACEHOLDER mirror of the payment domain's status vocabulary, defined
 * LOCALLY and never imported from `src/os/commerce/payment/` (Agent P owns
 * the real payment lifecycle in parallel this wave — see
 * `order_state_machine.ts`'s module doc for the exact integration seam).
 * The literal values intentionally match `payment/types.ts`'s real
 * `PaymentStatus` so a future swap is a type-level no-op, not a data
 * migration — but this is a deliberately independent declaration, not a
 * re-export, per this arc's isolation requirement. Order stores this ONLY
 * for display (e.g. an Order status screen showing "payment: pending") —
 * no Order transition is ever derived from this field directly; only
 * `OrderPaymentEvidence` (below) can cause the `paid` transition.
 */
export type PaymentStatus =
  | "unavailable"
  | "pending"
  | "accepted_placeholder"
  | "rejected"
  | "expired"
  | "refunded"
  | "error";

/**
 * PLACEHOLDER shape for the Delivery domain's status vocabulary. No real
 * Delivery capability exists anywhere in the repository yet (Agent D owns
 * it in Wave B) — this is this arc's own minimal invention of "the
 * smallest shape Order needs to reference by name," offered as a seam
 * Agent D may adopt, extend, or replace wholesale. Order stores this ONLY
 * for display; only `OrderDeliveryEvidence` (below) can cause the
 * `delivered` transition.
 */
export type DeliveryStatus = "not_started" | "in_progress" | "delivered" | "failed";

/**
 * Who may act on an Order, and how the state machine tells them apart.
 * This union is exhaustive BY DESIGN: there is no `"ai"`/`"bot"` member,
 * so no caller can ever construct one — the "no AI/bot actor may ever
 * cause [payment confirmation]" requirement is enforced structurally, not
 * just by a runtime check. `"payment_evidence"`/`"delivery_evidence"` are
 * not people — they represent an external, already-verified evidence
 * source (Agent P's real payment verification, Agent D's real delivery
 * verification); the state machine trusts the CALLER to only ever
 * construct one of these actor kinds from a genuinely verified evidence
 * path, exactly the same trust boundary `payment/types.ts` already
 * documents for `PaymentEvidence` itself ("Implementations MUST verify
 * any callback signature/HMAC themselves").
 */
export type OrderActorKind = "customer" | "merchant" | "payment_evidence" | "delivery_evidence";

/**
 * The party attempting an action. `pubkey` identifies a `"customer"`/
 * `"merchant"` actor (checked against `Order.buyerPubkey`/`sellerPubkey`);
 * it is omitted for the two evidence-kind actors, which are not a person
 * and are authorized purely by `kind`.
 */
export interface OrderActor {
  readonly kind: OrderActorKind;
  readonly pubkey?: string;
}

/** One entry in an Order's append-only transition history (for audit / UI timeline display). */
export interface OrderTransitionRecord {
  readonly from: OrderStatus | null;
  readonly to: OrderStatus;
  readonly action: OrderHistoryActionType;
  readonly actorKind: OrderActorKind;
  readonly at: number;
  readonly reason?: string;
}

/** A single Order: one customer's request to buy one product from one merchant. */
export interface Order {
  readonly id: string;
  readonly productId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly status: OrderStatus;
  /** No inventory/stock concept exists yet (Gap #10, open) — quantity is recorded but never checked against stock. */
  readonly quantity: number;
  /** Snapshot of `Product.priceCents` at order-creation time. Display metadata only — no charging happens here. */
  readonly unitPriceCents: number;
  readonly currency: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  /**
   * Opaque link to the real payment domain's own record (Agent P's
   * `PaymentDecision.paymentId`/`PaymentEvidence.paymentId`). `undefined`
   * until the first accepted `confirm_payment` evidence binds it; see
   * `order_state_machine.ts` for the binding/mismatch rule.
   */
  readonly paymentId?: string;
  /** Display-only mirror of the real payment's own status. Never drives a transition by itself. */
  readonly paymentStatus?: PaymentStatus;
  /** Opaque link to a future real delivery record (Agent D, Wave B). Same binding discipline as `paymentId`. */
  readonly deliveryId?: string;
  /** Display-only mirror of the real delivery's own status. Never drives a transition by itself. */
  readonly deliveryStatus?: DeliveryStatus;
  readonly history: readonly OrderTransitionRecord[];
}

/** Input to `createOrder()` — the customer-supplied + product-snapshot fields needed to open an Order. */
export interface CreateOrderInput {
  readonly id: string;
  readonly productId: string;
  readonly sellerPubkey: string;
  readonly unitPriceCents: number;
  readonly currency: string;
  readonly quantity?: number;
}

/**
 * Evidence that a specific payment settled — the ONLY thing that may ever
 * cause the `paid` transition (see `order_state_machine.ts`). Field shape
 * deliberately mirrors the real `payment/types.ts`'s `PaymentEvidence` (a
 * LOCAL, independent declaration — not imported, per this arc's isolation
 * requirement) with `productId` replaced by `orderId`, since binding a
 * payment to a specific Order (rather than just a Product) is this
 * boundary's own concern.
 */
export interface OrderPaymentEvidence {
  readonly orderId: string;
  readonly paymentId: string;
  readonly status: "settled" | "expired" | "refunded" | "error";
  readonly observedAt: number;
  readonly reason: string;
}

/** Evidence that a specific delivery completed — the ONLY thing that may ever cause the `delivered` transition. */
export interface OrderDeliveryEvidence {
  readonly orderId: string;
  readonly deliveryId: string;
  readonly status: "delivered" | "failed";
  readonly observedAt: number;
  readonly reason: string;
}

export type OrderActionType =
  | "submit"
  | "cancel"
  | "accept"
  | "reject"
  | "confirm_payment"
  | "fulfill"
  | "confirm_delivery"
  | "complete";

/** `OrderActionType` plus `"create"`, used only by `OrderTransitionRecord.action` — `createOrder()` produces the initial history entry but is not itself an `OrderAction` (there is no prior Order to apply one to). */
export type OrderHistoryActionType = OrderActionType | "create";

/** Every action `applyOrderAction` accepts, tagged by `type`. `create` is handled separately by `createOrder()` (no prior Order exists to apply an action to). */
export type OrderAction =
  | { readonly type: "submit"; readonly actor: OrderActor }
  | { readonly type: "cancel"; readonly actor: OrderActor; readonly reason?: string }
  | { readonly type: "accept"; readonly actor: OrderActor }
  | { readonly type: "reject"; readonly actor: OrderActor; readonly reason?: string }
  | { readonly type: "confirm_payment"; readonly actor: OrderActor; readonly evidence: OrderPaymentEvidence }
  | { readonly type: "fulfill"; readonly actor: OrderActor }
  | { readonly type: "confirm_delivery"; readonly actor: OrderActor; readonly evidence: OrderDeliveryEvidence }
  | { readonly type: "complete"; readonly actor: OrderActor };

/** Why a transition/creation attempt was rejected. Never a thrown error — always data. */
export type OrderRejectionCode =
  | "invalid_state"
  | "unauthorized_actor"
  | "evidence_mismatch"
  | "evidence_not_settled"
  | "invalid_input";

export type OrderTransitionResult =
  | { readonly ok: true; readonly order: Order }
  | { readonly ok: false; readonly code: OrderRejectionCode; readonly reason: string };
