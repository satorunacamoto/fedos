/**
 * Commerce Purchase/Payment Completion mega-arc (Agent P) — the
 * PaymentEvidence Port: the seam that lets a `PaymentEvidence`
 * (`./types.ts`), already confirmed AUTHORITATIVE by ONE process's own
 * `PaymentProvider`, travel to the OTHER counterparty's independent
 * process and be re-verified there before it may ever cause a settlement
 * transition.
 *
 * THE PROBLEM THIS CLOSES
 * ----------------------------------------------------------------------
 * `payment/state_machine.ts` already enforces the core invariant LOCALLY:
 * a raw customer/merchant claim, or an unverified provider callback, can
 * never move `PaymentSettlementLedger` to `paid`. But that ledger is
 * per-process. Two counterparties (Alice/buyer, Bob/seller) running
 * independent FedOS processes each have their OWN ledger — nothing
 * previously carried a `paid`-confirming `PaymentEvidence` from whichever
 * side's process actually observed real settlement (typically the
 * merchant's own payment rail/provider) to the OTHER side's process. This
 * file is that transport-agnostic seam: `Payment domain -> PaymentEvidence
 * Port <- encrypted/signed Commerce transport adapter`
 * (`../catalog/adapters/nostr/commerce_private_payment_evidence_bridge.ts`
 * is the concrete adapter; `RealPaymentEvidenceTransport` below implements
 * `PaymentEvidenceSendPort` on top of it).
 *
 * WHY THIS STILL NEVER WEAKENS AUTHORITY (read before touching either
 * function below)
 * ----------------------------------------------------------------------
 * `buildOutboundPaymentEvidenceSyncPayload()` REFUSES (returns `null`) to
 * ever construct a transportable payload for evidence that is not already
 * authoritative — re-checking `AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES`
 * (`./types.ts`) at the OUTBOUND boundary, even though a well-behaved
 * caller should never pass non-authoritative evidence here in the first
 * place. `applyInboundPaymentEvidenceSync()` is the RECEIVER's own
 * independent verification gate — it does NOT trust the sender's claimed
 * `verification` alone: it (1) requires the wire payload to be
 * well-formed, (2) requires the transport's own REAL, cryptographically
 * verified sender pubkey to match the ONE counterparty this Order expects
 * evidence from, (3) requires the Order binding to match, (4) requires the
 * amount to match, (5) requires the currency to match, (6) re-checks the
 * verification source is authoritative, and only THEN (7) hands the
 * reconstructed `PaymentEvidence` to `ledger.apply()`
 * (`PaymentSettlementLedger`/`DurablePaymentSettlementLedger`,
 * `./state_machine.ts`), which independently re-derives whether a
 * transition is even legal (idempotent no-op on a duplicate, rejected on a
 * replayed/out-of-order/stale transition) — the SAME authority gate a
 * local evidence application already goes through, never bypassed for a
 * transported one.
 *
 * A rejection at ANY of steps 1-6 NEVER calls `ledger.apply()` at all —
 * fail-fast before touching settlement state, matching
 * `PlaceholderPaymentProvider.ingestCallback()`'s own "reject BEFORE
 * mutating the ledger" discipline (`./noop_payment.ts`).
 *
 * DURABILITY: this file has no I/O of its own. Pairing
 * `applyInboundPaymentEvidenceSync()` with a `DurablePaymentSettlementLedger`
 * (`./persistence/durable_payment_settlement_ledger.ts`) instead of the
 * in-memory `PaymentSettlementLedger` is what makes an applied transition
 * survive a process restart — this file is agnostic to which one is
 * injected (both satisfy `PaymentEvidenceApplyLedgerPort` below, which
 * mirrors just the one method this file actually calls).
 */

import {
  AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES,
  type PaymentEvidence,
} from "./types.js";
import type { SettlementApplyResult } from "./state_machine.js";
import {
  isWellFormedPrivatePaymentEvidenceSyncPayload,
  type PrivatePaymentEvidenceSyncPayload,
} from "../events/commerce_private_payment_evidence_sync.js";

/** The Order/amount/currency binding a piece of `PaymentEvidence` is being sent FOR — payment domain code never imports `os/commerce/order`, so `orderId` stays a plain opaque string here too (matches `state_machine.ts`'s own module doc). */
export interface PaymentEvidenceOrderBinding {
  readonly orderId: string;
  readonly amountCents: number;
  readonly currency: string;
}

export interface PaymentEvidenceSendResult {
  readonly accepted: boolean;
  readonly message: string;
}

/**
 * The Port a concrete, encrypted/signed Commerce transport adapter
 * implements (`RealPaymentEvidenceTransport` below is the real one).
 * Payment-domain code depends only on THIS seam, never on Nostr/NIP-44/
 * relay specifics directly — mirrors `catalog/product_repository_port.ts`'s
 * own "Domain -> Port -> Adapter" convention.
 */
export interface PaymentEvidenceSendPort {
  send(
    evidence: PaymentEvidence,
    binding: PaymentEvidenceOrderBinding,
    counterpartyPubkeyHex: string,
  ): Promise<PaymentEvidenceSendResult>;
}

/**
 * Builds the wire payload for an OUTBOUND PaymentEvidence sync message.
 * Returns `null` (fails closed, never throws) if `evidence` is not itself
 * authoritative (re-checks BOTH `verification.source` against the
 * allowlist AND `verification.authoritative`, exactly like
 * `state_machine.ts`'s own `isAuthoritativeEvidence()` — never trusting
 * either alone), or if the binding/evidence fields are not well-formed.
 * This is the structural guarantee that a bare customer/merchant claim, or
 * unverified provider callback, can never even be PACKAGED for transport,
 * let alone sent.
 */
export function buildOutboundPaymentEvidenceSyncPayload(
  evidence: PaymentEvidence,
  binding: PaymentEvidenceOrderBinding,
  now: number,
): PrivatePaymentEvidenceSyncPayload | null {
  const verification = evidence.verification;
  if (verification === undefined) return null;
  if (!AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES.has(verification.source) || verification.authoritative !== true) {
    return null;
  }
  if (evidence.paymentId.length === 0 || evidence.productId.length === 0) return null;
  if (binding.orderId.length === 0) return null;
  if (!Number.isFinite(binding.amountCents) || binding.amountCents < 0 || !Number.isInteger(binding.amountCents)) {
    return null;
  }
  if (binding.currency.length === 0) return null;

  const wireVerification: PrivatePaymentEvidenceSyncPayload["verification"] | null =
    verification.source === "provider_verified"
      ? { source: "provider_verified", provider: verification.provider, verifiedAt: verification.verifiedAt }
      : verification.source === "test_simulator"
        ? { source: "test_simulator", simulator: verification.simulator }
        : // Unreachable: AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES only ever
          // contains "provider_verified"/"test_simulator" (see ./types.ts).
          // Fails closed rather than assuming, in case that set is ever widened
          // without this file being updated in lockstep.
          null;
  if (wireVerification === null) return null;

  const payload: PrivatePaymentEvidenceSyncPayload = {
    category: "private-payment-evidence-sync",
    formatVersion: 1,
    paymentId: evidence.paymentId,
    orderId: binding.orderId,
    productId: evidence.productId,
    amountCents: binding.amountCents,
    currency: binding.currency,
    status: evidence.status,
    verification: wireVerification,
    observedAt: evidence.observedAt,
    reason: evidence.reason,
    at: now,
  };
  return isWellFormedPrivatePaymentEvidenceSyncPayload(payload) ? payload : null;
}

/** What the receiver already, independently knows/expects for this Order — never derived from the inbound payload itself. */
export interface PaymentEvidenceReceiveExpectation {
  readonly expectedOrderId: string;
  /**
   * The ONLY real, verified pubkey ever trusted as the source of payment
   * evidence for this Order (typically the Order's own `sellerPubkey` —
   * whoever owns/observed the payment rail). A genuinely signed,
   * genuinely decryptable event from ANY other real identity — including
   * the buyer themselves, or a total stranger — is rejected here before
   * ever reaching the ledger.
   */
  readonly expectedCounterpartyPubkeyHex: string;
  readonly expectedAmountCents: number;
  readonly expectedCurrency: string;
  /**
   * OPTIONAL: when supplied, the evidence's own claimed provider/simulator
   * identity (`verification.provider` or `verification.simulator`) MUST
   * match exactly — closes the "provider identity" receiver-check the arc
   * brief lists separately from generic authenticity. Omitted (the
   * default) skips this specific check, matching every other optional
   * field's "absence means not enforced" convention in this module family.
   */
  readonly expectedProviderIdentity?: string;
}

/** The narrow seam this file actually calls — satisfied by both `PaymentSettlementLedger` and `DurablePaymentSettlementLedger` (`./state_machine.ts` / `./persistence/durable_payment_settlement_ledger.ts`) without either needing to `implements` anything. */
export interface PaymentEvidenceApplyLedgerPort {
  apply(evidence: PaymentEvidence, expectedOrderId: string): SettlementApplyResult;
}

export type PaymentEvidenceReceiveOutcome =
  | { readonly accepted: true; readonly result: SettlementApplyResult }
  | { readonly accepted: false; readonly reason: string };

/**
 * The receiver-side validation gate. `senderPubkeyHex` MUST be the
 * transport's own REAL, cryptographically verified signer (see
 * `commerce_private_payment_evidence_bridge.ts`'s
 * `verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope` —
 * `InboundPrivatePaymentEvidenceEnvelope.senderPubkeyHex`) — this function
 * does not itself verify any signature or decrypt anything; it is the
 * NEXT gate after that succeeds, and assumes nothing about the payload's
 * trustworthiness beyond "this exact sender, cryptographically confirmed,
 * sent this exact plaintext to me."
 *
 * Every check below runs BEFORE `ledger.apply()` is ever called — a
 * rejection at any step leaves the ledger completely untouched.
 */
export function applyInboundPaymentEvidenceSync(
  senderPubkeyHex: string,
  payload: unknown,
  expectation: PaymentEvidenceReceiveExpectation,
  ledger: PaymentEvidenceApplyLedgerPort,
): PaymentEvidenceReceiveOutcome {
  if (!isWellFormedPrivatePaymentEvidenceSyncPayload(payload)) {
    return { accepted: false, reason: "malformed or schema-invalid payment evidence sync payload" };
  }
  if (senderPubkeyHex.length === 0 || senderPubkeyHex !== expectation.expectedCounterpartyPubkeyHex) {
    return {
      accepted: false,
      reason: `payment evidence sender ("${senderPubkeyHex}") is not the expected counterparty ("${expectation.expectedCounterpartyPubkeyHex}") for this order -- a genuinely signed/decrypted message from the wrong party is not evidence of anything`,
    };
  }
  if (payload.orderId !== expectation.expectedOrderId) {
    return {
      accepted: false,
      reason: `payment evidence orderId ("${payload.orderId}") does not match the expected order ("${expectation.expectedOrderId}")`,
    };
  }
  if (payload.amountCents !== expectation.expectedAmountCents) {
    return {
      accepted: false,
      reason: `payment evidence amountCents (${payload.amountCents}) does not match the expected amount (${expectation.expectedAmountCents})`,
    };
  }
  if (payload.currency !== expectation.expectedCurrency) {
    return {
      accepted: false,
      reason: `payment evidence currency ("${payload.currency}") does not match the expected currency ("${expectation.expectedCurrency}")`,
    };
  }
  if (!AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES.has(payload.verification.source)) {
    return {
      accepted: false,
      reason: `payment evidence verification.source ("${payload.verification.source}") is not authoritative`,
    };
  }
  if (expectation.expectedProviderIdentity !== undefined) {
    const claimedIdentity =
      payload.verification.source === "provider_verified" ? payload.verification.provider : payload.verification.simulator;
    if (claimedIdentity !== expectation.expectedProviderIdentity) {
      return {
        accepted: false,
        reason: `payment evidence provider identity ("${claimedIdentity}") does not match the expected provider ("${expectation.expectedProviderIdentity}")`,
      };
    }
  }

  const evidence: PaymentEvidence = {
    paymentId: payload.paymentId,
    productId: payload.productId,
    observedAt: payload.observedAt,
    status: payload.status,
    reason: payload.reason,
    verification:
      payload.verification.source === "provider_verified"
        ? { source: "provider_verified", authoritative: true, provider: payload.verification.provider, verifiedAt: payload.verification.verifiedAt }
        : { source: "test_simulator", authoritative: true, simulator: payload.verification.simulator },
  };

  const result = ledger.apply(evidence, expectation.expectedOrderId);
  return { accepted: true, result };
}
