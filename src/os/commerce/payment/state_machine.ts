/**
 * Payment Hardening + PaymentEvidence/PaymentStatus + local simulator
 * (Commerce E2E Completion arc, Agent P) — the Payment state machine.
 *
 * This is the seam named in this arc's brief: `PaymentProvider` → verified
 * `PaymentEvidence` → THIS state machine → (future) an Order/entitlement
 * consumer. It is the ONLY code in `os/commerce/payment` that decides a
 * payment has reached a settlement-relevant state (paid, refunded,
 * disputed, ...).
 *
 * CORE INVARIANT (non-negotiable — see
 * `docs/commerce/COMMERCE-GAP-CLASSIFICATION.md` Gap #5): a raw customer
 * claim of "I paid" must NEVER cause a PAID-equivalent transition. Neither
 * can a raw merchant claim, nor an unverified provider callback. Only
 * `PaymentEvidence` whose `verification.source` is `"provider_verified"` or
 * `"test_simulator"` (see `PaymentEvidenceProvenance` in `./types.ts`) may
 * ever move this state machine forward.
 *
 * This is re-checked HERE, at runtime, against an explicit allowlist
 * (`AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES`) — never by trusting a
 * caller-suppliable `authoritative` boolean alone, since a dishonest or
 * buggy caller could always force one through with an unsafe cast
 * (`as PaymentEvidenceProvenance`). Both the discriminant AND the flag must
 * agree before any transition is even considered.
 *
 * Treats Order as an OPAQUE `orderId: string` throughout — this file never
 * imports from `os/commerce/order` (Agent O's territory, built in a
 * parallel worktree; the coordinator binds the two at the integration
 * gate). Every settlement record is bound to its `orderId` at creation
 * time, and `applySettlementEvidence` requires the caller to re-assert
 * which order it EXPECTS the evidence to belong to on every call — a
 * mismatch is rejected as wrong-order evidence, never silently applied.
 */

import { AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES, type PaymentEvidence } from "./types.js";

/**
 * Settlement-level states this state machine actually produces and tests.
 * Deliberately separate from the legacy, broader `PaymentStatus`
 * (request/decision-time vocabulary, `./types.ts`) — this union exists only
 * for the settlement/evidence side of the world, so widening it here never
 * perturbs `PaymentStatus`'s existing consumers outside `os/commerce/payment`.
 *
 *   - `pending`  — bound, awaiting authoritative evidence.
 *   - `paid`     — authoritative evidence confirmed settlement.
 *   - `failed`   — authoritative evidence reported an error/failed attempt.
 *   - `expired`  — authoritative evidence (or the original request) reported
 *                  the payment window elapsed before settlement.
 *   - `refunded` — authoritative evidence reported a reversal of a
 *                  previously-`paid` (or `disputed`) payment.
 *   - `disputed` — authoritative evidence reported a chargeback/dispute on a
 *                  previously-`paid` payment.
 */
export type SettlementStatus = "pending" | "paid" | "failed" | "expired" | "refunded" | "disputed";

/** One durable settlement record, keyed by the payment provider's own opaque `paymentId`. */
export interface PaymentSettlementState {
  readonly paymentId: string;
  /** Opaque Order id this payment is bound to. Never validated against `os/commerce/order` — see file header. */
  readonly orderId: string;
  readonly productId: string;
  readonly status: SettlementStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly history: readonly SettlementTransitionRecord[];
}

/** One applied transition, kept for audit/idempotency observability. */
export interface SettlementTransitionRecord {
  readonly from: SettlementStatus;
  readonly to: SettlementStatus;
  readonly at: number;
  readonly evidenceObservedAt: number;
  readonly reason: string;
}

export type SettlementApplyOutcome = "transitioned" | "no_op" | "rejected";

export interface SettlementApplyResult {
  readonly state: PaymentSettlementState;
  readonly outcome: SettlementApplyOutcome;
  readonly reason: string;
}

/**
 * Legal forward edges. Anything not listed here is rejected — including
 * every terminal state's outgoing edges except the two explicitly modeled
 * reversals (`paid` -> `refunded`/`disputed`, `disputed` -> `refunded`).
 * `failed`/`expired`/`refunded` are fully terminal: no evidence, however
 * authoritative, moves a payment out of them again (a fresh payment attempt
 * is a NEW `paymentId`, never a resurrected old one).
 */
const ALLOWED_TRANSITIONS: Readonly<Record<SettlementStatus, readonly SettlementStatus[]>> = {
  pending: ["paid", "failed", "expired"],
  paid: ["refunded", "disputed"],
  failed: [],
  expired: [],
  refunded: [],
  disputed: ["refunded"],
};

/** Maps a provider's terminal `PaymentEvidence.status` onto this state machine's `SettlementStatus` vocabulary. */
function evidenceStatusToSettlementStatus(status: PaymentEvidence["status"]): SettlementStatus {
  switch (status) {
    case "settled":
      return "paid";
    case "expired":
      return "expired";
    case "refunded":
      return "refunded";
    case "disputed":
      return "disputed";
    case "error":
      return "failed";
    default:
      return "failed";
  }
}

/**
 * True only for evidence this state machine may ever act on. Re-checks BOTH
 * `verification.source` (against the exported allowlist) AND
 * `verification.authoritative` — see file header for why both are checked
 * independently rather than trusting either alone.
 */
function isAuthoritativeEvidence(evidence: PaymentEvidence): boolean {
  const verification = evidence.verification;
  if (verification === undefined) return false;
  return AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES.has(verification.source) && verification.authoritative === true;
}

/** Creates a fresh `pending` settlement record for a newly-requested payment, bound to its order up front. */
export function createPendingSettlement(
  paymentId: string,
  orderId: string,
  productId: string,
  createdAt: number = Math.floor(Date.now() / 1000),
): PaymentSettlementState {
  return { paymentId, orderId, productId, status: "pending", createdAt, updatedAt: createdAt, history: [] };
}

/**
 * Applies one piece of `PaymentEvidence` to a settlement state. Pure,
 * total, never throws — every outcome (including every rejection) is
 * reported as data, matching this module's existing `PaymentProvider`
 * discipline.
 *
 * `expectedOrderId` is the caller's OWN belief about which order this
 * evidence is for — checked BEFORE authenticity, so a caller integrating
 * this into an Order flow gets wrong-order protection "for free" the
 * moment it plumbs its own `orderId` through, independent of whatever the
 * evidence itself claims.
 *
 * Idempotent by construction: re-applying evidence that would resolve to
 * the state's CURRENT status is a `"no_op"`, never a re-transition (no
 * duplicate history entry, no double-counted side effect for a caller
 * reacting to `"transitioned"`). Replay-safe by construction: evidence
 * that would move a state OUT of an already-terminal status (or backward
 * from where it currently sits) is `"rejected"`, never silently reapplied.
 */
export function applySettlementEvidence(
  state: PaymentSettlementState,
  evidence: PaymentEvidence,
  expectedOrderId: string,
): SettlementApplyResult {
  if (evidence.paymentId !== state.paymentId) {
    return {
      state,
      outcome: "rejected",
      reason: `evidence.paymentId ("${evidence.paymentId}") does not match this payment's paymentId ("${state.paymentId}")`,
    };
  }
  if (expectedOrderId !== state.orderId) {
    return {
      state,
      outcome: "rejected",
      reason: `wrong-order evidence: this payment is bound to order "${state.orderId}", not "${expectedOrderId}"`,
    };
  }
  if (!isAuthoritativeEvidence(evidence)) {
    const source = evidence.verification?.source ?? "(none)";
    return {
      state,
      outcome: "rejected",
      reason:
        `evidence is not authoritative (verification.source: ${source}) -- only "provider_verified" or ` +
        `"test_simulator" evidence may ever cause a settlement transition`,
    };
  }

  const target = evidenceStatusToSettlementStatus(evidence.status);
  if (target === state.status) {
    return { state, outcome: "no_op", reason: `duplicate/idempotent evidence -- payment is already "${state.status}"` };
  }

  const allowed = ALLOWED_TRANSITIONS[state.status];
  if (!allowed.includes(target)) {
    return {
      state,
      outcome: "rejected",
      reason: `illegal transition from "${state.status}" to "${target}" (stale/replayed evidence, or an invalid state-machine edge)`,
    };
  }

  const at = Math.floor(Date.now() / 1000);
  const transition: SettlementTransitionRecord = {
    from: state.status,
    to: target,
    at,
    evidenceObservedAt: evidence.observedAt,
    reason: evidence.reason,
  };
  const next: PaymentSettlementState = {
    ...state,
    status: target,
    updatedAt: at,
    history: [...state.history, transition],
  };
  return {
    state: next,
    outcome: "transitioned",
    reason: `applied authoritative evidence (${evidence.verification?.source}): "${state.status}" -> "${target}"`,
  };
}

/**
 * Convenience in-memory ledger wrapping the pure functions above, keyed by
 * `paymentId`. NOT itself a `PaymentProvider` — a thin, optional
 * bookkeeping helper a caller (future runtime wiring, or a test) may use
 * instead of managing `PaymentSettlementState` objects by hand. Holds no
 * I/O and contacts no rail, consistent with everything else in this
 * module.
 */
export class PaymentSettlementLedger {
  #states = new Map<string, PaymentSettlementState>();

  /**
   * Registers a newly-requested payment against its order, `pending`.
   * Throws only on a duplicate `paymentId` being bound twice (a programmer
   * error — e.g. reusing a provider's `paymentId` — never something an
   * attacker's input alone can trigger, since `paymentId`s are
   * provider-minted, opaque, and never caller-supplied).
   */
  bind(paymentId: string, orderId: string, productId: string, createdAt?: number): PaymentSettlementState {
    if (this.#states.has(paymentId)) {
      throw new Error(`PaymentSettlementLedger: paymentId "${paymentId}" is already bound`);
    }
    const state = createPendingSettlement(paymentId, orderId, productId, createdAt);
    this.#states.set(paymentId, state);
    return state;
  }

  /** Current settlement state, or `undefined` if `paymentId` was never bound. */
  get(paymentId: string): PaymentSettlementState | undefined {
    return this.#states.get(paymentId);
  }

  /**
   * Applies evidence to the bound state for `evidence.paymentId`. Evidence
   * for a `paymentId` that was never `bind()`-ed is rejected outright,
   * never silently used to create a new record — this ledger's whole point
   * is that a settlement record only ever exists because a real
   * `requestPayment()`/order flow created it first.
   */
  apply(evidence: PaymentEvidence, expectedOrderId: string): SettlementApplyResult {
    const existing = this.#states.get(evidence.paymentId);
    if (existing === undefined) {
      return {
        state: createPendingSettlement(evidence.paymentId, expectedOrderId, evidence.productId),
        outcome: "rejected",
        reason: `evidence for unknown/unbound paymentId "${evidence.paymentId}" -- was never registered via bind()`,
      };
    }
    const result = applySettlementEvidence(existing, evidence, expectedOrderId);
    if (result.outcome === "transitioned") {
      this.#states.set(evidence.paymentId, result.state);
    }
    return result;
  }
}
