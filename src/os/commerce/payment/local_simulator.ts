/**
 * Payment Hardening + PaymentEvidence/PaymentStatus + local simulator
 * (Commerce E2E Completion arc, Agent P) —
 * `DeterministicLocalPaymentProvider`.
 *
 * A LOUDLY-labeled TEST/LOCAL payment simulator, NOT a real payment rail.
 * It is the ONLY provider in this module allowed to authoritatively confirm
 * a PAID-equivalent outcome for local acceptance testing, because its
 * evidence is tagged `verification: { source: "test_simulator", ...,
 * authoritative: true }` — a distinct discriminant from every real/
 * unverified path (`PaymentEvidenceProvenance`, `./types.ts`) that
 * `payment/state_machine.ts` allowlists explicitly, by name, alongside
 * `"provider_verified"`.
 *
 * Structural guardrails against being mistaken for — or accidentally wired
 * into — a real rail:
 *
 *   1. The constructor requires an explicit `acknowledgeTestOnly: true`
 *      literal. Omitting it, or passing `false`, is a TYPE ERROR —
 *      `new DeterministicLocalPaymentProvider()` and
 *      `new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: false })`
 *      both fail to compile. This cannot be constructed by accident from a
 *      call site that forgot what it was doing. The SAME check is also
 *      re-verified at runtime (a caller could still reach the constructor
 *      from plain JS, or via an unsafe cast) — see the constructor body.
 *   2. The constructor THROWS if told, via the OPTIONAL `runtimeProfile`
 *      field, that it is running in a `"production"` profile. This module
 *      deliberately does NOT read `process.env` itself (this codebase's
 *      own convention elsewhere — e.g. `runtime/worker_crypto_config.ts` —
 *      is to accept an explicitly-injected environment value rather than
 *      read ambient globals from domain code); a real integration point
 *      wiring this in is expected to pass its OWN single source of truth
 *      for the current runtime profile through `runtimeProfile`.
 *   3. `getCapabilities()` advertises nothing — no `"*_placeholder"`
 *      capability a caller could mistake for a real rail's. `getStatus()`
 *      names itself "TEST/LOCAL SIMULATOR" in its `reason`.
 *   4. Settlement is NEVER inferred from `requestPayment()` alone — a
 *      freshly-requested payment stays unresolved until an explicit,
 *      separate `simulateSettlement()` (or an unmistakably-shaped
 *      `ingestCallback({ simulate: true, ... })` payload) is called. There
 *      is no code path where merely asking to pay something ends up paid.
 *
 * Like every other provider in this module: charges nothing, contacts no
 * network, opens no channel/invoice/checkout session.
 */

import type {
  PaymentCapability,
  PaymentDecision,
  PaymentEvidence,
  PaymentEvidenceProvenance,
  PaymentProvider,
  PaymentProviderStatus,
  PaymentRequest,
} from "./types.js";

/** The exact, unmistakable name every `test_simulator` evidence this class produces carries in `verification.simulator`. */
export const TEST_SIMULATOR_NAME = "DeterministicLocalPaymentProvider";

/** Explicit outcomes a local acceptance run may simulate. */
export type SimulatedSettlementOutcome = "paid" | "failed" | "expired" | "refunded" | "disputed";

const SIMULATED_SETTLEMENT_OUTCOMES: readonly SimulatedSettlementOutcome[] = [
  "paid",
  "failed",
  "expired",
  "refunded",
  "disputed",
];

export interface DeterministicLocalPaymentProviderOptions {
  /**
   * Must be the literal `true`. Exists purely so a call site cannot
   * construct this provider without visibly acknowledging what it is.
   */
  readonly acknowledgeTestOnly: true;
  /**
   * OPTIONAL, caller-supplied statement of the current runtime profile.
   * When `"production"`, the constructor THROWS — this simulator must
   * never be reachable from a production deployment profile. Omitted (or
   * any other value) is treated as safe, since this module has no ambient
   * way to know the profile itself (see file header).
   */
  readonly runtimeProfile?: "test" | "development" | "production" | (string & {});
}

interface SimulatorLedgerEntry {
  readonly orderId: string | undefined;
  readonly productId: string;
  status: SimulatedSettlementOutcome | "pending";
  readonly expiresAt: number | undefined;
}

/**
 * TEST/LOCAL payment simulator. See file header for the full set of
 * structural guardrails. Every method is total and never throws (except
 * the constructor's own explicit, intentional guards above).
 */
export class DeterministicLocalPaymentProvider implements PaymentProvider {
  #ledger = new Map<string, SimulatorLedgerEntry>();
  #nextId = 0;

  constructor(options: DeterministicLocalPaymentProviderOptions) {
    if (options === undefined || options === null || options.acknowledgeTestOnly !== true) {
      throw new Error(
        'DeterministicLocalPaymentProvider requires { acknowledgeTestOnly: true } -- ' +
          "this is a TEST/LOCAL simulator, never a real payment rail, and must never be constructed silently.",
      );
    }
    if (options.runtimeProfile === "production") {
      throw new Error(
        'DeterministicLocalPaymentProvider must never be constructed with runtimeProfile: "production" -- ' +
          "it is a TEST/LOCAL simulator only and can authoritatively fabricate a PAID-equivalent outcome.",
      );
    }
  }

  getStatus(): PaymentProviderStatus {
    return {
      available: true,
      reason: "TEST/LOCAL SIMULATOR ONLY -- not a real payment rail; produces deterministic evidence for local acceptance testing",
    };
  }

  getCapabilities(): readonly PaymentCapability[] {
    // Advertises nothing a caller could mistake for a real rail capability.
    return [];
  }

  async requestPayment(request: PaymentRequest): Promise<PaymentDecision> {
    if (!Number.isFinite(request.amountCents) || request.amountCents < 0) {
      return this.#decision(request, "rejected", false, "amount must be a non-negative number");
    }
    const now = Math.floor(Date.now() / 1000);
    if (request.expiresAt !== undefined && request.expiresAt <= now) {
      return this.#decision(request, "expired", false, "request's expiresAt is already in the past");
    }

    const paymentId = `local-sim-payment-${(this.#nextId += 1)}`;
    this.#ledger.set(paymentId, {
      orderId: request.orderId,
      productId: request.productId,
      status: "pending",
      expiresAt: request.expiresAt,
    });

    return {
      ...this.#decision(
        request,
        "accepted_placeholder",
        true,
        "TEST/LOCAL SIMULATOR: request accepted, awaiting an explicit simulateSettlement() call -- never auto-confirmed",
      ),
      paymentId,
      ...(request.expiresAt !== undefined ? { expiresAt: request.expiresAt } : {}),
    };
  }

  async observePayment(paymentId: string): Promise<PaymentEvidence> {
    const now = Math.floor(Date.now() / 1000);
    const entry = this.#ledger.get(paymentId);
    if (entry === undefined) {
      return { paymentId, productId: "", observedAt: now, status: "error", reason: "unknown paymentId" };
    }
    if (entry.expiresAt !== undefined && entry.expiresAt <= now && entry.status === "pending") {
      entry.status = "expired";
    }
    return this.#evidenceFor(paymentId, entry, now);
  }

  /**
   * The ONLY way this provider ever produces a settlement-relevant outcome
   * — always an explicit, deliberate call, never inferred from
   * `requestPayment()` or from an ambiguous inbound payload shape. This is
   * the "test/local-simulator evidence" `payment/state_machine.ts`
   * allowlists by name.
   */
  async simulateSettlement(paymentId: string, outcome: SimulatedSettlementOutcome): Promise<PaymentEvidence> {
    const now = Math.floor(Date.now() / 1000);
    const entry = this.#ledger.get(paymentId);
    if (entry === undefined) {
      return { paymentId, productId: "", observedAt: now, status: "error", reason: "unknown paymentId" };
    }
    entry.status = outcome;
    return this.#evidenceFor(paymentId, entry, now);
  }

  /**
   * Recognizes exactly ONE, unmistakably-labeled payload shape:
   * `{ simulate: true; paymentId: string; outcome: SimulatedSettlementOutcome }`.
   * Deliberately NOT webhook-shaped (no generic `event`/`status` field
   * name) so it can never be confused with, or accidentally fed, a real
   * provider's callback shape. Anything else returns `null`.
   */
  async ingestCallback(payload: unknown): Promise<PaymentEvidence | null> {
    if (typeof payload !== "object" || payload === null) return null;
    const candidate = payload as { simulate?: unknown; paymentId?: unknown; outcome?: unknown };
    if (candidate.simulate !== true) return null;
    if (typeof candidate.paymentId !== "string") return null;
    if (typeof candidate.outcome !== "string" || !SIMULATED_SETTLEMENT_OUTCOMES.includes(candidate.outcome as SimulatedSettlementOutcome)) {
      return null;
    }
    return this.simulateSettlement(candidate.paymentId, candidate.outcome as SimulatedSettlementOutcome);
  }

  async cancelPayment(paymentId: string): Promise<PaymentDecision> {
    const entry = this.#ledger.get(paymentId);
    if (entry === undefined) {
      return { allowed: false, status: "error", rail: "manual_placeholder", reason: "unknown paymentId", productId: "", paymentId };
    }
    entry.status = "failed";
    return {
      allowed: true,
      status: "rejected",
      rail: "manual_placeholder",
      reason: "TEST/LOCAL SIMULATOR: cancelled before settlement",
      productId: entry.productId,
      paymentId,
    };
  }

  async refundPayment(paymentId: string): Promise<PaymentEvidence> {
    return this.simulateSettlement(paymentId, "refunded");
  }

  #decision(request: PaymentRequest, status: PaymentDecision["status"], allowed: boolean, reason: string): PaymentDecision {
    return {
      allowed,
      status,
      rail: request.rail,
      reason,
      productId: request.productId,
      ...(request.buyerPubkey !== undefined ? { buyerPubkey: request.buyerPubkey } : {}),
      ...(request.orderId !== undefined ? { orderId: request.orderId } : {}),
    };
  }

  #evidenceFor(paymentId: string, entry: SimulatorLedgerEntry, now: number): PaymentEvidence {
    const statusMap: Record<SimulatedSettlementOutcome | "pending", PaymentEvidence["status"]> = {
      pending: "error", // Nothing settled yet -- see this class's own note on `error` below.
      paid: "settled",
      failed: "error",
      expired: "expired",
      refunded: "refunded",
      disputed: "disputed",
    };
    const provenance: PaymentEvidenceProvenance | undefined =
      entry.status === "pending"
        ? undefined // Not yet settled: no evidence to authoritatively hand out either way.
        : { source: "test_simulator", authoritative: true, simulator: TEST_SIMULATOR_NAME };
    return {
      paymentId,
      productId: entry.productId,
      observedAt: now,
      status: statusMap[entry.status],
      reason:
        entry.status === "pending"
          ? "TEST/LOCAL SIMULATOR: not yet settled -- awaiting an explicit simulateSettlement() call"
          : `TEST/LOCAL SIMULATOR: deterministic ledger state "${entry.status}"`,
      ...(provenance !== undefined ? { verification: provenance } : {}),
    };
  }
}
