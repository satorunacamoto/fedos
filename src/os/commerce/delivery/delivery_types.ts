/**
 * FedOS Commerce End-to-End Completion arc (Agent D, Wave B) — Delivery /
 * Fulfillment domain, types.
 *
 * Closes `docs/commerce/COMMERCE-GAP-CLASSIFICATION.md` Gap #7: *"No
 * delivery/fulfillment mechanism exists; `DigitalAsset` is dead code."*
 * Everything in this file is data shapes only — the guarded transition
 * function lives in `delivery_state_machine.ts`, mirroring the
 * `order/order_types.ts` + `order/order_state_machine.ts` split this arc
 * already established.
 *
 * ISOLATION: this file treats `Order` as an OPAQUE `orderId: string`
 * throughout and never imports from `src/os/commerce/order/` — the exact
 * posture `payment/state_machine.ts` documents for the same reason (Agent
 * O's `order/` is a parallel worktree this arc must not depend on to build
 * or test in isolation). `order/order_types.ts` already defines its OWN
 * local placeholder `DeliveryStatus`/`OrderDeliveryEvidence` shapes for the
 * exact same isolation reason — this file does not import those either;
 * the coordinator is responsible for translating between the two at the
 * integration gate (see this arc's final report for the exact translation
 * this module expects).
 *
 * `catalog/types.ts`'s `DigitalAsset` (an opaque `storageRef` pointer, zero
 * consumers repo-wide today) was read and considered as a base for the
 * delivery artifact this module produces. DECISION: superseded, not reused
 * — `DigitalAsset` is a static "this product has a downloadable thing"
 * catalog fact (bytes live elsewhere, unresolved), whereas this module
 * needs a delivery-EVENT-shaped artifact (produced once, at the moment a
 * specific delivery is confirmed, carrying real inline bytes for this
 * arc's demo-artifact requirement — see `delivery_artifact.ts`). Importing
 * `catalog/types.ts` directly would also violate this arc's per-agent
 * isolation posture (Agent C/O's territory, edited in parallel). A fresh,
 * local `DeliveryReceiptArtifact` type is defined in `delivery_artifact.ts`
 * instead.
 *
 * CORE INVARIANT (mirrors `payment/state_machine.ts`'s "a raw claim must
 * never cause a settlement transition", applied to delivery — the brief's
 * §20): a bare merchant "I shipped/delivered it" claim must NEVER, by
 * itself, be sufficient to reach `"delivered"`. See `DeliveryEvidence` /
 * `DeliveryEvidenceProvenance` below and `delivery_state_machine.ts`'s
 * module doc for the enforcement mechanism (a structural actor-kind gate
 * PLUS an independent runtime re-check of the evidence's own provenance,
 * exactly like payment's double-check discipline).
 *
 * STATUS: real, tested domain code — not reachable from the shipped
 * Electron app until the coordinator wires it in (same posture as the
 * rest of `os/commerce` pre-Phase-1, and as `order/` in this same arc).
 */

/**
 * The Delivery record's own lifecycle. Deliberately a SEPARATE concept
 * from `OrderStatus`/`PaymentStatus` — never collapsed into either, per
 * this arc's brief. Four states, each justified by a distinct actor/
 * authority boundary:
 *
 *   PENDING    — a Delivery record has been opened for a specific
 *                (asserted-paid) order, but the merchant has not yet
 *                claimed to have started fulfillment. Needed as a real
 *                state (not skipped straight to FULFILLING) so
 *                `createDelivery()` — which requires the caller to assert
 *                the order-paid precondition — is itself observable/
 *                auditable as a distinct event from the merchant's own
 *                later fulfillment claim; the two are different actors
 *                making different assertions at different times.
 *   FULFILLING — the merchant claims they have started fulfilling
 *                (packing, generating the digital artifact, handing to a
 *                carrier, ...). A bare, self-asserted `MerchantDeliveryClaim`
 *                is sufficient here — this mirrors `Order`'s own `fulfill`
 *                action already being a bare merchant claim with no
 *                evidence requirement (see `order_state_machine.ts`).
 *                There is no money-moving or entitlement risk in a
 *                merchant merely CLAIMING to be working on it.
 *   DELIVERED  — reached ONLY via authoritative `DeliveryEvidence` (see
 *                below) — never by a bare merchant claim. This is the
 *                state the core invariant protects.
 *   COMPLETED  — terminal closure once delivery is confirmed, via a
 *                further explicit customer/merchant `acknowledge` action.
 *                Kept distinct from DELIVERED for the identical reason
 *                `order_types.ts` keeps `OrderStatus`'s `"completed"`
 *                distinct from `"delivered"`: closing the record is a
 *                separate event from the delivery mechanism itself
 *                confirming receipt (e.g. a future dispute window could
 *                sit between the two). No further risk exists at this
 *                step, so either party may close it — mirrors
 *                `AUTHORIZED_ACTOR_KINDS.complete` in `order_state_machine.ts`.
 *
 * An `"acknowledged"` name (distinct from `"completed"`) was considered
 * and REJECTED: it would read as a near-synonym of the
 * `"recipient_acknowledgment"` evidence-provenance source (below), inviting
 * the false impression that reaching DELIVERED via that specific evidence
 * source automatically implies COMPLETED too. `"completed"` also gives a
 * clean 1:1 name mirror with `OrderStatus`'s own `"delivered"`/`"completed"`
 * pair, which is exactly what the coordinator binds this module's outputs
 * into (`confirm_delivery` / `complete` order actions).
 *
 * No `"failed"` status is modeled. `DeliveryEvidence.status === "failed"`
 * is accepted as valid INPUT (a caller can report it without the call
 * being an error) but causes no transition — this mirrors
 * `order_state_machine.ts`'s own documented, known gap for
 * `OrderDeliveryEvidence`'s `"failed"` status ("Order has no refund/failure
 * state yet"). Adding a real failure/retry state here was judged
 * out-of-scope scope-creep beyond this arc's brief (minimal justified set);
 * see the final report's PARTIAL/BLOCKED notes.
 */
export type DeliveryStatus = "pending" | "fulfilling" | "delivered" | "completed";

/** Every `DeliveryStatus` value, in a sensible display/reference order. */
export const DELIVERY_STATUSES: readonly DeliveryStatus[] = ["pending", "fulfilling", "delivered", "completed"];

/** `DeliveryStatus` values from which no further transition is ever legal. */
export const TERMINAL_DELIVERY_STATUSES: readonly DeliveryStatus[] = ["completed"];

/**
 * Who may act on a Delivery record, and how the state machine tells them
 * apart. Exhaustive by design — no `"ai"`/`"bot"` member, so no caller can
 * ever construct one, mirroring `OrderActorKind`'s own structural
 * guarantee. `"delivery_evidence"` is not a person — it represents an
 * external, already-verified evidence source; the state machine trusts the
 * CALLER to only ever construct this actor kind from a genuinely verified
 * evidence path (see `delivery_state_machine.ts`'s module doc for the
 * independent runtime re-check this module additionally performs, never
 * trusting actor kind alone).
 */
export type DeliveryActorKind = "merchant" | "customer" | "delivery_evidence";

/**
 * The party attempting an action. `pubkey` identifies a `"merchant"`/
 * `"customer"` actor (checked against `DeliveryRecord.sellerPubkey`/
 * `buyerPubkey`); omitted for the evidence-kind actor, which is not a
 * person and is authorized purely by `kind`.
 */
export interface DeliveryActor {
  readonly kind: DeliveryActorKind;
  readonly pubkey?: string;
}

/** One entry in a Delivery record's append-only transition history (audit / UI timeline display). */
export interface DeliveryTransitionRecord {
  readonly from: DeliveryStatus | null;
  readonly to: DeliveryStatus;
  readonly action: DeliveryHistoryActionType;
  readonly actorKind: DeliveryActorKind;
  readonly at: number;
  readonly reason?: string;
}

/**
 * A downloadable digital artifact this module actually produces once a
 * Delivery is confirmed — real bytes, not a UI label. See
 * `delivery_artifact.ts` for the deterministic builder. `undefined` until
 * the record reaches `"delivered"`.
 */
export interface DeliveryReceiptArtifact {
  readonly deliveryId: string;
  readonly orderId: string;
  readonly mimeType: string;
  readonly filename: string;
  /** The actual artifact bytes (UTF-8 text/JSON for this arc's digital/demo artifact — see module doc). */
  readonly content: string;
  readonly generatedAt: number;
}

/** One Delivery record: the fulfillment lifecycle for a single (opaque) Order. */
export interface DeliveryRecord {
  readonly id: string;
  /** Opaque link to `Order.id` (`os/commerce/order`). Never validated against that domain — see file header. */
  readonly orderId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly status: DeliveryStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  /** Set once evidence binds this record (first accepted `confirm_delivery`) — mirrors `Order.paymentId` binding discipline. */
  readonly evidenceSource?: DeliveryEvidenceProvenance["source"];
  /** The real digital artifact produced on delivery. See `DeliveryReceiptArtifact`. */
  readonly artifact?: DeliveryReceiptArtifact;
  readonly history: readonly DeliveryTransitionRecord[];
}

/**
 * Input to `createDelivery()`. `orderPaymentConfirmed` is the EXPLICIT
 * precondition parameter the brief's §16 failure case calls for
 * ("delivery before paid must be rejected/impossible"): since this module
 * treats Order as opaque and never reads its real status, it cannot check
 * payment itself — so it instead REQUIRES the caller (the coordinator, who
 * DOES have the real Order/Payment state) to explicitly assert this on
 * every call. It is a required `boolean`, not optional, so a caller cannot
 * silently omit the assertion; `createDelivery()` rejects outright unless
 * it is literally `true` (see `delivery_state_machine.ts`).
 */
export interface CreateDeliveryInput {
  readonly id: string;
  readonly orderId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly orderPaymentConfirmed: boolean;
}

/**
 * A raw, self-asserted "I have started fulfilling this" claim by the
 * merchant. Explicitly modeled as its OWN type (the brief's §20) to make
 * clear this is a CLAIM, not proof — it is sufficient to cause
 * `"pending"` -> `"fulfilling"` (see module doc for why that transition
 * alone carries no risk) but is structurally incapable of reaching
 * `"delivered"` on its own: `applyDeliveryAction`'s `"start_fulfillment"`
 * action is the only place this type is consumed, and that action's
 * target status is never `"delivered"`.
 */
export interface MerchantDeliveryClaim {
  readonly deliveryId: string;
  readonly orderId: string;
  readonly claimedAt: number;
  readonly note?: string;
}

/**
 * WHO/WHAT produced a `DeliveryEvidence`, and whether it may ever be
 * trusted to cause a `"delivered"` transition. Mirrors
 * `payment/types.ts`'s `PaymentEvidenceProvenance` exactly (same
 * discriminated-union-on-`source` shape, same "the literal type alone is
 * not trusted — `delivery_state_machine.ts` independently re-checks both
 * `source` against an allowlist AND `authoritative` at runtime" discipline
 * — see that file's module doc).
 *
 * Three sources, matching the brief's own enumeration for delivery:
 *   - `merchant_claim` — a raw, unverified "I delivered it" assertion by
 *     the seller. NEVER authoritative, by construction — this is the
 *     literal case the core invariant (this file's module doc) forbids.
 *   - `recipient_acknowledgment` — the CUSTOMER explicitly confirming
 *     receipt via their own UI action (e.g. tapping "I received this" on
 *     the order). DECISION (this arc, since a real cryptographic delivery
 *     proof depends on Agent T's parallel Trust/QR work, which this arc
 *     does not depend on or block on): treated as authoritative and
 *     sufficient ON ITS OWN to reach `"delivered"`. This is an honest
 *     minimum viable authoritative signal — the customer confirming their
 *     OWN receipt has no incentive misalignment in the direction the core
 *     invariant guards against (a merchant falsely claiming delivery to
 *     themselves reach a paid-adjacent terminal state); the risk profile
 *     is symmetric to a customer, not the seller, being the one who could
 *     misrepresent it, which is out of scope for the invariant this arc
 *     protects. Documented explicitly per the brief's instruction.
 *   - `signed_proof` — the seam for Agent T's eventual signed-receipt
 *     output (Trust/QR) to slot into, once it exists. Authoritative.
 *     `verifiedAt` records when the signature/proof check actually passed.
 *     NOT implemented by any producer in this arc — no code anywhere
 *     constructs a `signed_proof` evidence value today; it exists purely
 *     as the typed seam Agent T's work can target. See final report.
 */
export type DeliveryEvidenceProvenance =
  | {
      readonly source: "merchant_claim";
      readonly authoritative: false;
      /** Non-secret, informational only. Never proof of anything. */
      readonly claimedBy?: string;
    }
  | {
      readonly source: "recipient_acknowledgment";
      readonly authoritative: true;
      /** Opaque pubkey of the customer who acknowledged receipt, when known. Not a secret. */
      readonly acknowledgedBy?: string;
    }
  | {
      readonly source: "signed_proof";
      readonly authoritative: true;
      /** Name of the proof mechanism, e.g. a future "FedosTrustQrReceipt". */
      readonly provider: string;
      /** Unix seconds the signature/proof check actually passed. */
      readonly verifiedAt: number;
    };

/**
 * Every `DeliveryEvidenceProvenance["source"]` value that MAY authorize a
 * `"delivered"` transition (`delivery_state_machine.ts`). Nothing else
 * may — mirrors `payment/types.ts`'s `AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES`
 * exactly. This is the runtime allowlist backing the core invariant: a
 * bare merchant claim can never cause `"delivered"`, no matter what its
 * `authoritative` field claims (a dishonest/buggy caller could always try
 * to force one through with an unsafe cast — this allowlist is re-checked
 * independently of the type system at runtime).
 */
export const AUTHORITATIVE_DELIVERY_EVIDENCE_SOURCES: ReadonlySet<DeliveryEvidenceProvenance["source"]> = new Set([
  "recipient_acknowledgment",
  "signed_proof",
]);

/**
 * Evidence that a specific delivery completed (or failed) — the ONLY thing
 * that may ever cause the `"delivered"` transition, and only when
 * `verification`'s `source` is in `AUTHORITATIVE_DELIVERY_EVIDENCE_SOURCES`
 * AND `verification.authoritative === true`. A missing `verification` is
 * treated identically to a non-authoritative one (fail-closed) — mirrors
 * `PaymentEvidence.verification`'s own documented fail-closed default.
 */
export interface DeliveryEvidence {
  readonly deliveryId: string;
  readonly orderId: string;
  readonly status: "delivered" | "failed";
  readonly observedAt: number;
  readonly reason: string;
  readonly verification?: DeliveryEvidenceProvenance;
}

export type DeliveryActionType = "start_fulfillment" | "confirm_delivery" | "acknowledge";

/** `DeliveryActionType` plus `"create"`, used only by `DeliveryTransitionRecord.action`. */
export type DeliveryHistoryActionType = DeliveryActionType | "create";

/** Every action `applyDeliveryAction` accepts, tagged by `type`. `"create"` is handled separately by `createDelivery()`. */
export type DeliveryAction =
  | { readonly type: "start_fulfillment"; readonly actor: DeliveryActor; readonly claim: MerchantDeliveryClaim }
  | { readonly type: "confirm_delivery"; readonly actor: DeliveryActor; readonly evidence: DeliveryEvidence }
  | { readonly type: "acknowledge"; readonly actor: DeliveryActor };

/** Why a transition/creation attempt was rejected. Never a thrown error — always data. */
export type DeliveryRejectionCode =
  | "invalid_state"
  | "unauthorized_actor"
  | "evidence_mismatch"
  | "evidence_not_authoritative"
  | "order_not_paid"
  | "invalid_input";

export type DeliveryTransitionResult =
  | { readonly ok: true; readonly delivery: DeliveryRecord }
  | { readonly ok: false; readonly code: DeliveryRejectionCode; readonly reason: string };
