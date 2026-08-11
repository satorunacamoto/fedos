/**
 * Reputation / Persona Epoch — REAL issuance gating (Wave B, Agent R closure
 * pass). THIS FILE is the piece that converts the design in
 * `attestation_types.ts`/`persona_epoch.ts`/`disclosure_layers.ts` from
 * "type-only scaffolding" into runtime behavior: it is the ONLY place in
 * `src/os/commerce/reputation/` that decides whether a
 * `TradeCompletionAttestationPayload` may actually be minted.
 *
 * INPUT AUTHORITY — WHY A BARE CLAIM CANNOT REACH THIS FUNCTION
 * ----------------------------------------------------------------------
 * `issueTradeCompletionAttestation` never accepts an `Order` object
 * directly — it takes an `OrderRepository` (`../order/order_repository_port.js`,
 * NOT modified by this file) and an `orderId`, and looks the order up
 * itself. The only way an `Order` in that repository can have
 * `status === "completed"` is by having actually been driven there through
 * `applyOrderAction` (`../order/order_state_machine.js`, NOT modified by
 * this file) — a real, guarded, actor-checked state machine requiring, in
 * sequence, a real `submit`/`accept`/`confirm_payment` (evidence-actor-only)
 * /`fulfill`/`confirm_delivery` (evidence-actor-only)/`complete` transition
 * chain. A UI checkbox, a customer's bare "it's done" message, or a
 * hand-constructed `{status: "completed"}` object passed directly cannot
 * satisfy this gate, because this function never accepts an `Order` value
 * from the caller at all — only an id to look up in a repository whose
 * `save()` calls only ever come from the real state machine's own output
 * (see `../order/ui/order_ui_controller.ts` for the only two call sites
 * that ever call `repository.save()` today, both of which pipe
 * `applyOrderAction`'s own result straight through).
 *
 * IDENTITY BINDING — WHAT THIS FUNCTION DOES AND DOES NOT VERIFY
 * ----------------------------------------------------------------------
 * `Order.buyerPubkey`/`Order.sellerPubkey` are REAL identity pubkeys (the
 * same trust boundary `order_state_machine.ts`'s own `OrderActor.pubkey`
 * check uses) — this function requires the caller-supplied
 * `attestorRealPubkey` to match the Order's own corresponding party for the
 * claimed `attestorRole`, exactly mirroring `isActorIdentityAuthorized` in
 * `order_state_machine.ts`. Precisely like that function, THIS module does
 * NOT itself cryptographically authenticate that `attestorRealPubkey`
 * belongs to whoever is actually calling it — that authentication (a real
 * signed Nostr/Messenger session, or equivalent) is the CALLER's
 * responsibility, exactly the same trust boundary the Order/Delivery state
 * machines already document for every `OrderActor`/evidence-kind actor. A
 * future coordinator wiring this into the real Electron app MUST only ever
 * construct `attestorRealPubkey` from an already-authenticated local
 * identity, never from unauthenticated caller input.
 *
 * `subjectEpoch: PersonaEpoch` (the counterparty's own claimed reputation
 * identity) is likewise CALLER-SUPPLIED, TRUSTED input — this domain layer
 * has no database mapping a real pubkey to a `PersonaEpoch` (deliberately:
 * see `persona_epoch_registry.ts`'s header on why the registry itself
 * carries no such binding, to avoid becoming exactly the kind of
 * real-identity-to-pseudonym linkage table this design is trying to avoid
 * creating). The coordinator's job, at integration time, is to ensure the
 * `subjectEpoch` passed in here is genuinely the one the counterparty
 * presented for this trade (e.g. exchanged as part of the order/negotiation
 * flow) — this function can only check STRUCTURAL/CRYPTOGRAPHIC properties
 * of the epoch it's given (validity window, key-pair correspondence), never
 * "is this really the right epoch for this counterparty," which requires
 * information this domain layer does not and should not hold.
 *
 * WHY EPOCH-CURRENCY IS CHECKED HERE BUT NOT AT VERIFICATION TIME
 * ----------------------------------------------------------------------
 * `issueTradeCompletionAttestation` REJECTS if either the attestor's or the
 * subject's `PersonaEpoch` is not currently valid (`isPersonaEpochCurrentlyValid`,
 * `persona_epoch.ts`) at the moment of issuance — an epoch is a
 * bounded-lifetime identity, and minting a NEW claim under an
 * already-expired identity makes no sense. `attestation_sign_verify.ts`'s
 * verify functions, by contrast, do NOT re-check epoch currency — an
 * attestation signed while the epoch was genuinely valid remains a
 * genuine, unforged historical record after the epoch later expires ("old
 * epoch handled correctly" — a verifier reading history should not have
 * yesterday's true statement retroactively become "invalid" just because
 * today the identity that made it aged out).
 */

import type { PersonaEpoch } from "./persona_epoch.js";
import { isPersonaEpochCurrentlyValid } from "./persona_epoch.js";
import type {
  ReputationAttestationPayload,
  TradeCompletionAttestationPayload,
  TradeCompletionCategory,
  TradeCompletionOutcome,
} from "./attestation_types.js";
import {
  computeTradeRefDigestHex,
  generateTradeRefSaltHex,
} from "./trade_ref_digest.js";
import {
  computeAttestationRef,
  signReputationAttestation,
  signTradeCompletionAttestation,
  verifyTradeCompletionAttestationEnvelope,
  type ReputationAttestationEnvelope,
  type TradeCompletionAttestationEnvelope,
} from "./attestation_sign_verify.js";
import { PersonaEpochSigningKeypair } from "./persona_epoch_signing_keypair.js";
import type { LocalTradeCompletionAttestationStore } from "./trade_completion_attestation_store.js";
import type { OrderRepository } from "../order/order_repository_port.js";
import type { Order } from "../order/order_types.js";

export type ReputationIssuanceRejectionCode =
  | "order_not_found"
  | "order_not_completed"
  | "unauthorized_attestor"
  | "self_rating"
  | "epoch_key_mismatch"
  | "epoch_not_valid"
  | "duplicate_attestation"
  | "invalid_input";

export interface IssueTradeCompletionAttestationRequest {
  readonly orderId: string;
  /** Which side of the Order the attestor claims to be. */
  readonly attestorRole: "buyer" | "seller";
  /** The attestor's REAL identity pubkey — MUST already be authenticated by
   * the caller before this function is invoked (see this file's header). */
  readonly attestorRealPubkey: string;
  readonly attestorEpoch: PersonaEpoch;
  readonly attestorSigningKeypair: PersonaEpochSigningKeypair;
  /** The counterparty's own claimed reputation identity — caller-supplied,
   * trusted input (see this file's header). */
  readonly subjectEpoch: PersonaEpoch;
  readonly category: TradeCompletionCategory;
  readonly outcome: TradeCompletionOutcome;
  /** Optional explicit salt (tests only, for determinism) — a fresh random
   * salt is generated when omitted; see `trade_ref_digest.ts`. */
  readonly tradeRefSaltHex?: string;
}

export type IssueTradeCompletionAttestationResult =
  | {
      readonly ok: true;
      readonly envelope: TradeCompletionAttestationEnvelope;
      /** The salt used to compute `tradeRefDigestHex` — the caller (or an
       * AUTHORIZED-layer dispute flow) must retain this OUT OF BAND to ever
       * re-derive/verify the digest later via `verifyTradeRefDigest`; it is
       * never itself part of the signed payload. */
      readonly tradeRefSaltHex: string;
    }
  | { readonly ok: false; readonly code: ReputationIssuanceRejectionCode; readonly reason: string };

export interface ReputationIssuanceDeps {
  readonly orderRepository: OrderRepository;
  readonly store: LocalTradeCompletionAttestationStore;
}

function reject(code: ReputationIssuanceRejectionCode, reason: string): IssueTradeCompletionAttestationResult {
  return { ok: false, code, reason };
}

function ownRealPubkeyFor(order: Order, attestorRole: "buyer" | "seller"): string {
  return attestorRole === "buyer" ? order.buyerPubkey : order.sellerPubkey;
}

/**
 * The single gate a `TradeCompletionAttestationPayload` must pass through
 * this codebase's runtime — see this file's header for the full authority
 * argument. Never throws; every rejection is returned as data
 * (`{ ok: false, code, reason }`), matching this repo's `OrderTransitionResult`
 * convention.
 */
export function issueTradeCompletionAttestation(
  deps: ReputationIssuanceDeps,
  request: IssueTradeCompletionAttestationRequest,
  now: number,
): IssueTradeCompletionAttestationResult {
  if (!Number.isInteger(now) || now < 0) {
    return reject("invalid_input", "now must be a non-negative integer");
  }
  if (request.orderId.length === 0) {
    return reject("invalid_input", "orderId must be non-empty");
  }
  if (request.attestorRealPubkey.length === 0) {
    return reject("invalid_input", "attestorRealPubkey must be non-empty");
  }

  const order = deps.orderRepository.findById(request.orderId);
  if (order === undefined) {
    return reject("order_not_found", `no such order "${request.orderId}"`);
  }

  // Gate #1: the order must have ACTUALLY reached "completed" through the
  // real, guarded Order state machine — see this file's header.
  if (order.status !== "completed") {
    return reject("order_not_completed", `order "${order.id}" has status "${order.status}", not "completed"`);
  }

  // Gate #2: defensive self-trade check. Nothing in `order_state_machine.ts`
  // currently forbids `buyerPubkey === sellerPubkey` (an out-of-scope
  // pre-existing gap this file does not fix — see this file's own
  // final-summary note to the coordinator); this function refuses to ever
  // turn such an order into a reputation attestation regardless.
  if (order.buyerPubkey === order.sellerPubkey) {
    return reject("self_rating", "order buyer and seller are the same real identity");
  }

  // Gate #3: the attestor must genuinely be the party of the order they
  // claim to be (same identity-authorization discipline as
  // `order_state_machine.ts`'s own `isActorIdentityAuthorized`).
  const expectedOwnPubkey = ownRealPubkeyFor(order, request.attestorRole);
  if (request.attestorRealPubkey !== expectedOwnPubkey) {
    return reject(
      "unauthorized_attestor",
      `attestorRealPubkey does not match the order's ${request.attestorRole}`,
    );
  }

  // Gate #4: self-rating at the persona-epoch level — an attestor may never
  // name themselves (by epoch key) as the subject, independent of the
  // real-pubkey check above.
  if (request.attestorEpoch.epochKeyPublicHex === request.subjectEpoch.epochKeyPublicHex) {
    return reject("self_rating", "attestor and subject epoch keys must differ");
  }
  if (request.attestorEpoch.epochId === request.subjectEpoch.epochId) {
    return reject("self_rating", "attestor and subject epoch ids must differ");
  }

  // Gate #5: the signing keypair actually presented must match the claimed
  // attestor epoch's own public key — "wrong signer" protection at
  // construction time (verification time re-checks this independently via
  // `verifyTradeCompletionAttestationEnvelope`'s KEY_ID_MISMATCH/
  // SIGNATURE_INVALID checks).
  if (request.attestorSigningKeypair.publicKeyHex !== request.attestorEpoch.epochKeyPublicHex) {
    return reject("epoch_key_mismatch", "attestorSigningKeypair does not match attestorEpoch.epochKeyPublicHex");
  }

  // Gate #6: both epochs must be currently valid AT ISSUANCE TIME — see
  // this file's header on why this is issuance-time-only, not
  // verification-time.
  if (!isPersonaEpochCurrentlyValid(request.attestorEpoch, now)) {
    return reject("epoch_not_valid", "attestorEpoch is not currently valid");
  }
  if (!isPersonaEpochCurrentlyValid(request.subjectEpoch, now)) {
    return reject("epoch_not_valid", "subjectEpoch is not currently valid");
  }

  // Gate #7: duplicate / trade-reuse protection.
  if (deps.store.hasAttestedOrder(order.id, request.attestorRealPubkey)) {
    return reject(
      "duplicate_attestation",
      `attestor has already issued a trade-completion attestation for order "${order.id}"`,
    );
  }

  const tradeRefSaltHex = request.tradeRefSaltHex ?? generateTradeRefSaltHex();
  const tradeRefDigestHex = computeTradeRefDigestHex(order.id, tradeRefSaltHex);

  const payload: TradeCompletionAttestationPayload = {
    attestorEpochKeyPublicHex: request.attestorEpoch.epochKeyPublicHex,
    subjectEpochId: request.subjectEpoch.epochId,
    tradeRefDigestHex,
    category: request.category,
    outcome: request.outcome,
    completedAt: now,
    formatVersion: 1,
  };

  const envelope = signTradeCompletionAttestation(payload, request.attestorSigningKeypair, {
    issuer: request.attestorEpoch.epochKeyPublicHex,
    subject: request.subjectEpoch.epochId,
    issuedAt: now,
  });

  deps.store.record(order.id, request.attestorRealPubkey, envelope);

  return { ok: true, envelope, tradeRefSaltHex };
}

export interface BuildReputationAttestationSummaryOptions {
  readonly subjectEpoch: PersonaEpoch;
  readonly aggregatorKeypair: PersonaEpochSigningKeypair;
  readonly store: LocalTradeCompletionAttestationStore;
  readonly asOf: number;
}

export type BuildReputationAttestationSummaryResult =
  | { readonly ok: true; readonly envelope: ReputationAttestationEnvelope }
  | { readonly ok: false; readonly code: "epoch_key_mismatch" | "invalid_input"; readonly reason: string };

/**
 * Aggregates every currently-VALID-signature `TradeCompletionAttestationEnvelope`
 * naming `subjectEpoch` as the subject into a `ReputationAttestationPayload`
 * summary, self-signed by the subject's own epoch key (this design's
 * documented self-attesting-aggregator mode — see `trust_issuance_port.ts`'s
 * and `attestation_types.ts`'s headers). Tampered/invalid-signature entries
 * in the store are silently excluded from the count (defense in depth — the
 * store should never actually contain one, since `record()` is only ever
 * called with a just-signed envelope, but a summary must never trust
 * unverified data regardless of how it got there).
 */
export function buildReputationAttestationSummary(
  options: BuildReputationAttestationSummaryOptions,
): BuildReputationAttestationSummaryResult {
  if (options.aggregatorKeypair.publicKeyHex !== options.subjectEpoch.epochKeyPublicHex) {
    return { ok: false, code: "epoch_key_mismatch", reason: "aggregatorKeypair must match subjectEpoch's own key" };
  }
  if (!Number.isInteger(options.asOf) || options.asOf < 0) {
    return { ok: false, code: "invalid_input", reason: "asOf must be a non-negative integer" };
  }

  const candidates = options.store.findBySubjectEpochId(options.subjectEpoch.epochId);
  const verified = candidates.filter((envelope) => verifyTradeCompletionAttestationEnvelope(envelope).status === "VALID");
  const countedTrades = verified.filter((envelope) => envelope.payload.outcome !== "not_completed");
  const attestationRefs = countedTrades.map((envelope) => computeAttestationRef(envelope));

  const payload: ReputationAttestationPayload = {
    subjectEpochId: options.subjectEpoch.epochId,
    subjectEpochKeyPublicHex: options.subjectEpoch.epochKeyPublicHex,
    verifiedTradeCount: countedTrades.length,
    attestationRefs,
    asOf: options.asOf,
    formatVersion: 1,
  };

  const envelope = signReputationAttestation(payload, options.aggregatorKeypair, {
    issuer: options.subjectEpoch.epochKeyPublicHex,
    issuedAt: options.asOf,
  });
  return { ok: true, envelope };
}
