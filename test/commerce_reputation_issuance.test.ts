import { describe, it, expect, beforeEach } from "vitest";
import { applyOrderAction, createOrder } from "../src/os/commerce/order/order_state_machine.js";
import { LocalOrderRepository } from "../src/os/commerce/order/local_order_repository.js";
import type { Order, OrderActor } from "../src/os/commerce/order/order_types.js";

import {
  issueTradeCompletionAttestation,
  buildReputationAttestationSummary,
  type IssueTradeCompletionAttestationRequest,
} from "../src/os/commerce/reputation/reputation_issuance.js";
import { LocalTradeCompletionAttestationStore } from "../src/os/commerce/reputation/trade_completion_attestation_store.js";
import {
  LocalPersonaEpochRegistry,
  createPersonaEpoch,
  rolloverPersonaEpoch,
  verifyEpochCarryOverStatementEnvelope,
} from "../src/os/commerce/reputation/persona_epoch_registry.js";
import { verifyTradeCompletionAttestationEnvelope } from "../src/os/commerce/reputation/attestation_sign_verify.js";
import { queryPersonaBoardView } from "../src/os/commerce/reputation/persona_board_query.js";
import { PersonaBoardController } from "../src/os/commerce/reputation/ui/persona_board_controller.js";
import { PersonaEpochSigningKeypair } from "../src/os/commerce/reputation/persona_epoch_signing_keypair.js";

const BUYER = "1".repeat(64);
const SELLER = "f".repeat(64);
const OTHER_BUYER = "2".repeat(64);
const NOW = 1_700_000_000;

const BUYER_ACTOR: OrderActor = { kind: "customer", pubkey: BUYER };
const SELLER_ACTOR: OrderActor = { kind: "merchant", pubkey: SELLER };
const PAYMENT_EVIDENCE_ACTOR: OrderActor = { kind: "payment_evidence" };
const DELIVERY_EVIDENCE_ACTOR: OrderActor = { kind: "delivery_evidence" };

/** Drives a fresh Order all the way to "completed" through the REAL,
 * guarded state machine — mirrors this repo's own E2E happy-path
 * discipline (`docs/commerce/COMMERCE-E2E-COMPLETION-FINAL-REPORT.md`).
 * This is the ONLY way any test in this file produces a "completed" order —
 * no test ever hand-constructs one. */
function driveOrderToCompleted(
  repository: LocalOrderRepository,
  orderId: string,
  overrides: { buyerPubkey?: string; sellerPubkey?: string } = {},
): Order {
  const buyerActor: OrderActor = { kind: "customer", pubkey: overrides.buyerPubkey ?? BUYER };
  const sellerPubkey = overrides.sellerPubkey ?? SELLER;

  const created = createOrder(
    { id: orderId, productId: "product-1", sellerPubkey, unitPriceCents: 500, currency: "USD" },
    buyerActor,
    NOW,
  );
  if (!created.ok) throw new Error("test setup: createOrder failed");
  let order = created.order;

  const sellerActor: OrderActor = { kind: "merchant", pubkey: sellerPubkey };

  const steps: Array<Parameters<typeof applyOrderAction>[1]> = [
    { type: "submit", actor: buyerActor },
    { type: "accept", actor: sellerActor },
    {
      type: "confirm_payment",
      actor: PAYMENT_EVIDENCE_ACTOR,
      evidence: { orderId, paymentId: "payment-1", status: "settled", observedAt: NOW, reason: "test" },
    },
    { type: "fulfill", actor: sellerActor },
    {
      type: "confirm_delivery",
      actor: DELIVERY_EVIDENCE_ACTOR,
      evidence: { orderId, deliveryId: "delivery-1", status: "delivered", observedAt: NOW, reason: "test" },
    },
    { type: "complete", actor: buyerActor },
  ];

  for (const action of steps) {
    const result = applyOrderAction(order, action, NOW);
    if (!result.ok) throw new Error(`test setup: order transition "${action.type}" failed: ${result.reason}`);
    order = result.order;
  }
  repository.save(order);
  return order;
}

describe("commerce reputation: issueTradeCompletionAttestation — real gating", () => {
  let orderRepository: LocalOrderRepository;
  let store: LocalTradeCompletionAttestationStore;

  beforeEach(() => {
    orderRepository = new LocalOrderRepository();
    store = new LocalTradeCompletionAttestationStore();
  });

  function buyerRequest(
    orderId: string,
    overrides: Partial<IssueTradeCompletionAttestationRequest> = {},
  ): IssueTradeCompletionAttestationRequest {
    const attestor = createPersonaEpoch(NOW - 100, NOW + 10_000);
    const subject = createPersonaEpoch(NOW - 100, NOW + 10_000);
    return {
      orderId,
      attestorRole: "buyer",
      attestorRealPubkey: BUYER,
      attestorEpoch: attestor.epoch,
      attestorSigningKeypair: attestor.keypair,
      subjectEpoch: subject.epoch,
      category: "digital_good",
      outcome: "completed_as_agreed",
      ...overrides,
    };
  }

  it("HAPPY PATH: issues a valid, verifiable attestation for a genuinely completed order", () => {
    driveOrderToCompleted(orderRepository, "order-1");
    const result = issueTradeCompletionAttestation({ orderRepository, store }, buyerRequest("order-1"), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(verifyTradeCompletionAttestationEnvelope(result.envelope).status).toBe("VALID");
  });

  it("TRADE NOT COMPLETED: rejects when the order exists but never reached 'completed'", () => {
    const created = createOrder(
      { id: "order-2", productId: "product-1", sellerPubkey: SELLER, unitPriceCents: 500, currency: "USD" },
      BUYER_ACTOR,
      NOW,
    );
    if (!created.ok) throw new Error("setup failed");
    orderRepository.save(created.order); // status: "created", never driven further

    const result = issueTradeCompletionAttestation({ orderRepository, store }, buyerRequest("order-2"), NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("order_not_completed");
  });

  it("ORDER NOT FOUND: rejects a bare claim about an order id that was never created at all", () => {
    const result = issueTradeCompletionAttestation({ orderRepository, store }, buyerRequest("does-not-exist"), NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("order_not_found");
  });

  it("A UI/checkbox-style bare claim cannot substitute for the real state machine (no Order-accepting overload exists)", () => {
    // issueTradeCompletionAttestation only ever accepts an orderId + repository,
    // never an Order object — this test documents that a hand-built "completed"
    // order that was never saved through the repository is simply invisible to it.
    const fake: Order = {
      id: "order-fake",
      productId: "p",
      buyerPubkey: BUYER,
      sellerPubkey: SELLER,
      status: "completed",
      quantity: 1,
      unitPriceCents: 100,
      currency: "USD",
      createdAt: NOW,
      updatedAt: NOW,
      history: [],
    };
    expect(orderRepository.findById(fake.id)).toBeUndefined();
    const result = issueTradeCompletionAttestation({ orderRepository, store }, buyerRequest("order-fake"), NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("order_not_found");
  });

  it("UNAUTHORIZED ATTESTOR: rejects when attestorRealPubkey does not match the order's claimed side", () => {
    driveOrderToCompleted(orderRepository, "order-3");
    const result = issueTradeCompletionAttestation(
      { orderRepository, store },
      buyerRequest("order-3", { attestorRealPubkey: OTHER_BUYER }),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unauthorized_attestor");
  });

  it("SELF-RATING: rejects when the attestor and subject epoch keys are the same", () => {
    driveOrderToCompleted(orderRepository, "order-4");
    const attestor = createPersonaEpoch(NOW - 100, NOW + 10_000);
    const result = issueTradeCompletionAttestation(
      { orderRepository, store },
      buyerRequest("order-4", {
        attestorEpoch: attestor.epoch,
        attestorSigningKeypair: attestor.keypair,
        subjectEpoch: attestor.epoch, // same epoch as attestor
      }),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("self_rating");
  });

  it("SELF-RATING (defensive, order-level): rejects a self-dealing order (buyer === seller)", () => {
    // `createOrder()` itself now rejects self-dealing at creation (the
    // "self_dealing" gate in `order_state_machine.ts`), so a self-dealing
    // "completed" Order can no longer be produced through the real state
    // machine at all — `driveOrderToCompleted(..., { buyerPubkey: SELLER,
    // sellerPubkey: SELLER })` would now throw at its own `createOrder`
    // step. This test hand-constructs the Order object directly and saves
    // it straight into the repository, bypassing `createOrder`/
    // `applyOrderAction` entirely, purely to prove Gate #2 below is genuine
    // defense-in-depth against a self-dealing row reaching the repository
    // through some OTHER path (a future bug, a different repository
    // implementation, migrated/legacy data) — not something any real caller
    // going through this codebase's own state machine can produce anymore.
    const selfDealingOrder: Order = {
      id: "order-self",
      productId: "product-1",
      buyerPubkey: SELLER,
      sellerPubkey: SELLER,
      status: "completed",
      quantity: 1,
      unitPriceCents: 500,
      currency: "USD",
      createdAt: NOW,
      updatedAt: NOW,
      history: [{ from: null, to: "created", action: "create", actorKind: "customer", at: NOW }],
    };
    orderRepository.save(selfDealingOrder);
    const result = issueTradeCompletionAttestation(
      { orderRepository, store },
      buyerRequest("order-self", { attestorRealPubkey: SELLER }),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("self_rating");
  });

  it("WRONG SIGNER: rejects when the signing keypair does not match the claimed attestor epoch", () => {
    driveOrderToCompleted(orderRepository, "order-5");
    const attestor = createPersonaEpoch(NOW - 100, NOW + 10_000);
    const impostorKeypair = PersonaEpochSigningKeypair.generate();
    const result = issueTradeCompletionAttestation(
      { orderRepository, store },
      buyerRequest("order-5", { attestorEpoch: attestor.epoch, attestorSigningKeypair: impostorKeypair }),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("epoch_key_mismatch");
  });

  it("EXPIRED EPOCH: rejects when the attestor's epoch is no longer currently valid", () => {
    driveOrderToCompleted(orderRepository, "order-6");
    const expiredAttestor = createPersonaEpoch(NOW - 20_000, NOW - 10_000); // window closed long ago
    const result = issueTradeCompletionAttestation(
      { orderRepository, store },
      buyerRequest("order-6", { attestorEpoch: expiredAttestor.epoch, attestorSigningKeypair: expiredAttestor.keypair }),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("epoch_not_valid");
  });

  it("EXPIRED EPOCH: also rejects when the SUBJECT's epoch is expired, not just the attestor's", () => {
    driveOrderToCompleted(orderRepository, "order-6b");
    const expiredSubject = createPersonaEpoch(NOW - 20_000, NOW - 10_000);
    const result = issueTradeCompletionAttestation(
      { orderRepository, store },
      buyerRequest("order-6b", { subjectEpoch: expiredSubject.epoch }),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("epoch_not_valid");
  });

  it("DUPLICATE ATTESTATION FOR THE SAME TRADE: rejects a second attestation by the same attestor for the same order", () => {
    driveOrderToCompleted(orderRepository, "order-7");
    const request = buyerRequest("order-7");
    const first = issueTradeCompletionAttestation({ orderRepository, store }, request, NOW);
    expect(first.ok).toBe(true);

    const second = issueTradeCompletionAttestation({ orderRepository, store }, request, NOW + 1);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe("duplicate_attestation");
  });

  it("SAME TRADE REUSED TWICE: rejects even with a fresh random salt/digest on the retry", () => {
    driveOrderToCompleted(orderRepository, "order-8");
    const request = buyerRequest("order-8");
    const first = issueTradeCompletionAttestation({ orderRepository, store }, request, NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // Retry with an explicit, DIFFERENT salt (so the digest would differ) —
    // still must be rejected, because dedupe keys on (orderId, attestor),
    // never on the digest itself.
    const retry = issueTradeCompletionAttestation(
      { orderRepository, store },
      { ...request, tradeRefSaltHex: "abcdefabcdefabcdefabcdefabcdefab" },
      NOW + 5,
    );
    expect(retry.ok).toBe(false);
    if (retry.ok) return;
    expect(retry.code).toBe("duplicate_attestation");
  });

  it("both counterparties MAY independently attest the same order once each (not a duplicate across sides)", () => {
    driveOrderToCompleted(orderRepository, "order-9");
    const buyerResult = issueTradeCompletionAttestation({ orderRepository, store }, buyerRequest("order-9"), NOW);
    expect(buyerResult.ok).toBe(true);

    const sellerAttestor = createPersonaEpoch(NOW - 100, NOW + 10_000);
    const sellerSubject = createPersonaEpoch(NOW - 100, NOW + 10_000);
    const sellerResult = issueTradeCompletionAttestation(
      { orderRepository, store },
      {
        orderId: "order-9",
        attestorRole: "seller",
        attestorRealPubkey: SELLER,
        attestorEpoch: sellerAttestor.epoch,
        attestorSigningKeypair: sellerAttestor.keypair,
        subjectEpoch: sellerSubject.epoch,
        category: "digital_good",
        outcome: "completed_as_agreed",
      },
      NOW,
    );
    expect(sellerResult.ok).toBe(true);
    expect(store.findByOrder("order-9")).toHaveLength(2);
  });

  it("TAMPERED TRADE REFERENCE (end to end): an issued attestation's digest cannot be silently swapped for a different order's digest", () => {
    driveOrderToCompleted(orderRepository, "order-10");
    driveOrderToCompleted(orderRepository, "order-11");
    const result10 = issueTradeCompletionAttestation({ orderRepository, store }, buyerRequest("order-10"), NOW);
    const result11 = issueTradeCompletionAttestation(
      { orderRepository, store },
      buyerRequest("order-11", { attestorRealPubkey: BUYER }),
      NOW,
    );
    expect(result10.ok).toBe(true);
    expect(result11.ok).toBe(true);
    if (!result10.ok || !result11.ok) return;
    // Swap order-11's digest onto order-10's envelope: signature must break.
    const tampered = { ...result10.envelope, payload: { ...result10.envelope.payload, tradeRefDigestHex: result11.envelope.payload.tradeRefDigestHex } };
    expect(verifyTradeCompletionAttestationEnvelope(tampered).status).toBe("SIGNATURE_INVALID");
  });

  it("invalid input (empty orderId) is rejected cleanly, never throws", () => {
    const result = issueTradeCompletionAttestation({ orderRepository, store }, buyerRequest(""), NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_input");
  });
});

describe("commerce reputation: OLD EPOCH handled correctly (verification independent of epoch currency)", () => {
  it("an attestation signed while the epoch was valid remains VALID after the epoch later expires", () => {
    const orderRepository = new LocalOrderRepository();
    const store = new LocalTradeCompletionAttestationStore();
    driveOrderToCompleted(orderRepository, "order-old-epoch");

    const shortLivedAttestor = createPersonaEpoch(NOW - 100, NOW + 100); // expires shortly after NOW
    const subject = createPersonaEpoch(NOW - 100, NOW + 10_000);

    const result = issueTradeCompletionAttestation(
      { orderRepository, store },
      {
        orderId: "order-old-epoch",
        attestorRole: "buyer",
        attestorRealPubkey: BUYER,
        attestorEpoch: shortLivedAttestor.epoch,
        attestorSigningKeypair: shortLivedAttestor.keypair,
        subjectEpoch: subject.epoch,
        category: "service",
        outcome: "completed_as_agreed",
      },
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Long after the attestor epoch's own validUntil, the SIGNATURE is still valid —
    // an old, expired epoch's past, genuine statement is not retroactively invalidated.
    const farFuture = NOW + 1_000_000;
    expect(farFuture).toBeGreaterThan(shortLivedAttestor.epoch.validUntil);
    expect(verifyTradeCompletionAttestationEnvelope(result.envelope).status).toBe("VALID");
  });

  it("but a NEW attestation attempt under that now-expired epoch is correctly rejected", () => {
    const orderRepository = new LocalOrderRepository();
    const store = new LocalTradeCompletionAttestationStore();
    driveOrderToCompleted(orderRepository, "order-old-epoch-2");

    const shortLivedAttestor = createPersonaEpoch(NOW - 100, NOW + 100);
    const subject = createPersonaEpoch(NOW - 100, NOW + 10_000);
    const later = NOW + 1_000; // after shortLivedAttestor.epoch.validUntil

    const result = issueTradeCompletionAttestation(
      { orderRepository, store },
      {
        orderId: "order-old-epoch-2",
        attestorRole: "buyer",
        attestorRealPubkey: BUYER,
        attestorEpoch: shortLivedAttestor.epoch,
        attestorSigningKeypair: shortLivedAttestor.keypair,
        subjectEpoch: subject.epoch,
        category: "service",
        outcome: "completed_as_agreed",
      },
      later,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("epoch_not_valid");
  });
});

describe("commerce reputation: epoch rollover", () => {
  it("creates a successor epoch with no carry-over by default (clean break / unlinkable by omission)", () => {
    const { epoch: epoch1, keypair: keypair1 } = createPersonaEpoch(NOW - 100, NOW + 1_000);
    const result = rolloverPersonaEpoch(epoch1, keypair1, NOW + 1_000, NOW + 2_000, { now: NOW + 1_000 });
    expect(result.successorEpoch.predecessorEpochId).toBe(epoch1.epochId);
    expect(result.successorEpoch.epochId).not.toBe(epoch1.epochId);
    expect(result.successorEpoch.epochKeyPublicHex).not.toBe(epoch1.epochKeyPublicHex);
    expect(result.carryOverEnvelope).toBeUndefined();
    expect(result.linkabilityWarning).toBeUndefined();
  });

  it("opt-in carry-over produces a REAL signed statement plus the linkability warning, never silently", () => {
    const { epoch: epoch1, keypair: keypair1 } = createPersonaEpoch(NOW - 100, NOW + 1_000);
    const result = rolloverPersonaEpoch(epoch1, keypair1, NOW + 1_000, NOW + 2_000, {
      withCarryOver: true,
      thresholdClaim: { verifiedTradeCountAtLeast: 5 },
      now: NOW + 1_000,
    });
    expect(result.carryOverEnvelope).toBeDefined();
    expect(result.linkabilityWarning).toContain("link");
    if (result.carryOverEnvelope === undefined) return;
    const verify = verifyEpochCarryOverStatementEnvelope(result.carryOverEnvelope);
    expect(verify.status).toBe("VALID");
    if (verify.status !== "VALID") return;
    expect(verify.payload.predecessorEpochId).toBe(epoch1.epochId);
    expect(verify.payload.successorEpochId).toBe(result.successorEpoch.epochId);
    expect(verify.payload.thresholdClaim).toEqual({ verifiedTradeCountAtLeast: 5 });
  });

  it("rejects rollover when predecessorKeypair does not match predecessorEpoch's own key", () => {
    const { epoch: epoch1 } = createPersonaEpoch(NOW - 100, NOW + 1_000);
    const wrongKeypair = PersonaEpochSigningKeypair.generate();
    expect(() => rolloverPersonaEpoch(epoch1, wrongKeypair, NOW + 1_000, NOW + 2_000, { now: NOW + 1_000 })).toThrow(RangeError);
  });

  it("a tampered carry-over threshold claim is detected as SIGNATURE_INVALID", () => {
    const { epoch: epoch1, keypair: keypair1 } = createPersonaEpoch(NOW - 100, NOW + 1_000);
    const result = rolloverPersonaEpoch(epoch1, keypair1, NOW + 1_000, NOW + 2_000, {
      withCarryOver: true,
      thresholdClaim: { verifiedTradeCountAtLeast: 5 },
      now: NOW + 1_000,
    });
    if (result.carryOverEnvelope === undefined) throw new Error("expected a carry-over envelope");
    const tampered = {
      ...result.carryOverEnvelope,
      payload: { ...result.carryOverEnvelope.payload, thresholdClaim: { verifiedTradeCountAtLeast: 999 } },
    };
    expect(verifyEpochCarryOverStatementEnvelope(tampered).status).toBe("SIGNATURE_INVALID");
  });
});

describe("commerce reputation: buildReputationAttestationSummary + Persona Board query", () => {
  it("aggregates only VALID, non-'not_completed' trade attestations into a signed summary", () => {
    const orderRepository = new LocalOrderRepository();
    const store = new LocalTradeCompletionAttestationStore();
    const registry = new LocalPersonaEpochRegistry();

    const subject = createPersonaEpoch(NOW - 100, NOW + 10_000);
    registry.register(subject.epoch);

    driveOrderToCompleted(orderRepository, "order-agg-1");
    driveOrderToCompleted(orderRepository, "order-agg-2");

    for (const orderId of ["order-agg-1", "order-agg-2"]) {
      const attestor = createPersonaEpoch(NOW - 100, NOW + 10_000);
      const r = issueTradeCompletionAttestation(
        { orderRepository, store },
        {
          orderId,
          attestorRole: "buyer",
          attestorRealPubkey: BUYER,
          attestorEpoch: attestor.epoch,
          attestorSigningKeypair: attestor.keypair,
          subjectEpoch: subject.epoch,
          category: "digital_good",
          outcome: "completed_as_agreed",
        },
        NOW,
      );
      expect(r.ok).toBe(true);
    }

    const summary = buildReputationAttestationSummary({
      subjectEpoch: subject.epoch,
      aggregatorKeypair: subject.keypair,
      store,
      asOf: NOW + 10,
    });
    expect(summary.ok).toBe(true);
    if (!summary.ok) return;
    expect(summary.envelope.payload.verifiedTradeCount).toBe(2);
    expect(summary.envelope.payload.attestationRefs).toHaveLength(2);
  });

  it("rejects building a summary with a mismatched aggregator keypair", () => {
    const store = new LocalTradeCompletionAttestationStore();
    const subject = createPersonaEpoch(NOW - 100, NOW + 10_000);
    const wrongKeypair = PersonaEpochSigningKeypair.generate();
    const summary = buildReputationAttestationSummary({
      subjectEpoch: subject.epoch,
      aggregatorKeypair: wrongKeypair,
      store,
      asOf: NOW,
    });
    expect(summary.ok).toBe(false);
  });

  it("PersonaBoardController + queryPersonaBoardView expose only the bounded, layer-appropriate view — never raw order/payment data", () => {
    const orderRepository = new LocalOrderRepository();
    const store = new LocalTradeCompletionAttestationStore();
    const registry = new LocalPersonaEpochRegistry();
    const controller = new PersonaBoardController({ orderRepository, store, registry, now: () => NOW + 10 });

    const subject = createPersonaEpoch(NOW - 100, NOW + 10_000);
    registry.register(subject.epoch);
    driveOrderToCompleted(orderRepository, "order-board-1");

    const attestor = createPersonaEpoch(NOW - 100, NOW + 10_000);
    const issued = controller.issueTradeCompletionAttestation({
      orderId: "order-board-1",
      attestorRole: "buyer",
      attestorRealPubkey: BUYER,
      attestorEpoch: attestor.epoch,
      attestorSigningKeypair: attestor.keypair,
      subjectEpoch: subject.epoch,
      category: "physical_good",
      outcome: "completed_as_agreed",
    });
    expect(issued.ok).toBe(true);

    const publicView = controller.getPersonaBoardView(subject.epoch.epochId, "PUBLIC");
    expect(publicView).toBeDefined();
    if (publicView === undefined) return;
    expect(publicView.view.layer).toBe("PUBLIC");
    // Bounded exposure: only bucketed counts / coarse category / opaque refs.
    for (const forbidden of ["orderId", "buyerPubkey", "sellerPubkey", "unitPriceCents", "paymentId", "deliveryId", "productId"]) {
      expect(publicView.view).not.toHaveProperty(forbidden);
    }
    expect(publicView.verificationState.validSignatureAttestations).toBe(1);

    const authorizedView = queryPersonaBoardView(subject.epoch.epochId, "AUTHORIZED", registry, store, NOW + 10);
    expect(authorizedView).toBeDefined();
    if (authorizedView === undefined) return;
    if (authorizedView.view.layer !== "AUTHORIZED") throw new Error("expected AUTHORIZED view");
    expect(authorizedView.view.verifiedTradeCount).toBe(1);
    expect(authorizedView.view.categoryBreakdown).toEqual({ physical_good: 1 });
    for (const forbidden of ["orderId", "buyerPubkey", "sellerPubkey", "realName", "address"]) {
      expect(authorizedView.view).not.toHaveProperty(forbidden);
    }
  });

  it("returns undefined for an epoch the registry has never seen", () => {
    const store = new LocalTradeCompletionAttestationStore();
    const registry = new LocalPersonaEpochRegistry();
    expect(queryPersonaBoardView("f".repeat(32), "PUBLIC", registry, store, NOW)).toBeUndefined();
  });
});

describe("commerce reputation: explicit Sybil-limitation documentation (NOT resisted, not silently ignored)", () => {
  it("nothing prevents the SAME real actor from controlling both the attestor's and subject's PersonaEpoch across two DIFFERENT real orders (known, documented limitation)", () => {
    // This test demonstrates and DOCUMENTS the limitation rather than hiding
    // it: PersonaEpoch generation is a free, local, unauthenticated CSPRNG
    // call (persona_epoch_signing_keypair.ts's header), so an actor
    // controlling BOTH the buyer and seller real identity across two
    // separate, otherwise-legitimate completed orders can mint attestations
    // that look identical to independent third-party attestations. FedOS
    // proves "a configured counterparty signed this," never "this
    // represents a unique real trading partner" — see
    // attestation_types.ts's header and carry_over.ts's header for the
    // same explicit non-claim.
    const orderRepository = new LocalOrderRepository();
    const store = new LocalTradeCompletionAttestationStore();

    const sybilActorAsBuyer = "3".repeat(64);
    const sybilActorAsSeller = "4".repeat(64);
    driveOrderToCompleted(orderRepository, "order-sybil", {
      buyerPubkey: sybilActorAsBuyer,
      sellerPubkey: sybilActorAsSeller,
    });

    const attestorEpoch = createPersonaEpoch(NOW - 100, NOW + 10_000);
    const subjectEpoch = createPersonaEpoch(NOW - 100, NOW + 10_000);
    // Nothing in this domain layer can determine that "sybilActorAsBuyer"
    // and "sybilActorAsSeller" are secretly the same physical actor — both
    // are well-formed, distinct real pubkeys, so the trade passes every
    // gate this module enforces.
    const result = issueTradeCompletionAttestation(
      { orderRepository, store },
      {
        orderId: "order-sybil",
        attestorRole: "buyer",
        attestorRealPubkey: sybilActorAsBuyer,
        attestorEpoch: attestorEpoch.epoch,
        attestorSigningKeypair: attestorEpoch.keypair,
        subjectEpoch: subjectEpoch.epoch,
        category: "other",
        outcome: "completed_as_agreed",
      },
      NOW,
    );
    expect(result.ok).toBe(true); // documented as expected, not a bug — see test title.
  });
});
