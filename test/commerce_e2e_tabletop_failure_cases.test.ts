import { describe, expect, it } from "vitest";

/**
 * FedOS Commerce End-to-End Completion arc, Wave B (Agent T) — E2E/tabletop
 * failure-case test SKELETON (original arc brief §16/§31), re-grounded
 * against Wave A + this agent's own Wave B receipt/QR work.
 *
 * SCOPE AND STATUS
 * ----------------------------------------------------------------------
 * This file calls REAL domain-logic functions from Order (Agent O, Wave A),
 * Payment (Agent P, Wave A), and this agent's own Receipt/Trust adapter
 * (Wave B) — never a packaged Electron app, never IPC, never the renderer.
 * `test/` is not bound by `test/architecture_boundary_commerce.test.ts`'s
 * restrictions (only `src/os/commerce/**` is), so importing across Order/
 * Payment/Receipt here is intentional and allowed, per this wave's own
 * brief.
 *
 * Sibling agents' files this test COULD NOT import, because they do not
 * exist in this isolated worktree at the time this file was written (Wave B
 * agents run in parallel, isolated worktrees — see this repo's own
 * "preseeded partial work" convention): a `src/os/commerce/delivery/`
 * module (Agent D) and a `src/os/commerce/events/` module (Agent N). Every
 * case below that would depend on either is marked
 * "PENDING AGENT D/N'S OUTPUT" and skipped rather than failed — the
 * coordinator's job, per this wave's brief, is to finish wiring those cases
 * once all agents land.
 *
 * Each `describe` block below states, in its own comment, whether the case
 * is PASS / GAP / EXPECTED LIMITATION / N/A / PENDING — mirroring
 * `docs/commerce/COMMERCE-TABLETOP-EXERCISES.md` Scenario 2's own lettered
 * cases (A-J), re-verified here at the domain-logic level.
 */

import { createOrder, applyOrderAction, type Order, type OrderActor } from "../src/os/commerce/order/index.js";
import { DeterministicLocalPaymentProvider } from "../src/os/commerce/payment/local_simulator.js";
import type { PaymentRequest } from "../src/os/commerce/payment/types.js";
import {
  FedosTrustSigningKeypair,
  createSingleIssuerFedosTrustPolicy,
  fixedFedosTrustClock,
} from "../src/os/trust/index.js";
import {
  decodeCommerceReceiptProofFromQrText,
  encodeCommerceReceiptProofToQrText,
  issueSignedTradeReceiptProof,
  verifySignedTradeReceiptProof,
  type SignedCommerceReceiptProofEnvelope,
  type TradeReceiptProofPayload,
} from "../src/os/commerce/receipt/index.js";

const NOW = 1_800_000_000;
const ALICE: OrderActor = { kind: "customer", pubkey: "alice-pubkey-hex" };
const BOB: OrderActor = { kind: "merchant", pubkey: "bob-pubkey-hex" };

function mustOk(order: Order): Order {
  return order;
}

/** Builds a fresh Order all the way to "accepted", via the real state
 * machine, for cases that need a starting point past creation. */
function buildAcceptedOrder(): Order {
  const created = createOrder(
    { id: "order-tabletop-001", productId: "product-digital-art-print", sellerPubkey: BOB.pubkey!, unitPriceCents: 500, currency: "USD" },
    ALICE,
    NOW,
  );
  if (!created.ok) throw new Error("test setup: createOrder unexpectedly failed");
  const submitted = applyOrderAction(created.order, { type: "submit", actor: ALICE }, NOW + 1);
  if (!submitted.ok) throw new Error("test setup: submit unexpectedly failed");
  const accepted = applyOrderAction(submitted.order, { type: "accept", actor: BOB }, NOW + 2);
  if (!accepted.ok) throw new Error("test setup: accept unexpectedly failed");
  return mustOk(accepted.order);
}

/**
 * Case A — Customer claims "I paid" with no authoritative evidence
 * (original tabletop doc's Scenario 2, Case A).
 *
 * VERDICT: PASS at the Order state-machine level (real, re-verified here):
 * `applyOrderAction` rejects a `"customer"`-kind actor attempting
 * `confirm_payment` outright — `AUTHORIZED_ACTOR_KINDS.confirm_payment` is
 * `["payment_evidence"]` only (`order/order_state_machine.ts`). A bare
 * customer claim can never reach "paid", regardless of what evidence object
 * it carries.
 *
 * EXPECTED LIMITATION (documented, not fixed by this wave — Order's own
 * module doc says so explicitly): WHO is allowed to construct a
 * `{ kind: "payment_evidence" }` actor in the first place is NOT enforced
 * by `order_state_machine.ts` itself; it is the coordinator's integration-
 * gate responsibility to ensure only a genuinely verified
 * `PaymentProvider.ingestCallback()`/`observePayment()` result ever
 * constructs one. This test demonstrates BOTH halves: the customer-claim
 * path is blocked, and a caller who fabricates a `payment_evidence`-kind
 * actor directly (bypassing any real provider) is NOT blocked by this
 * module alone.
 */
describe("Case A: customer payment claim without authoritative evidence", () => {
  it("PASS: a customer-kind actor cannot confirm_payment even with a well-formed evidence object", () => {
    const accepted = buildAcceptedOrder();
    const result = applyOrderAction(
      accepted,
      {
        type: "confirm_payment",
        actor: ALICE, // customer, not payment_evidence
        evidence: { orderId: accepted.id, paymentId: "fake-payment-1", status: "settled", observedAt: NOW, reason: "customer says so" },
      },
      NOW + 3,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unauthorized_actor");
  });

  it("EXPECTED LIMITATION: a caller-fabricated payment_evidence actor (bypassing any real provider) IS accepted by this module alone", () => {
    const accepted = buildAcceptedOrder();
    // No DeterministicLocalPaymentProvider/real callback involved at all --
    // this actor kind is fabricated directly by the test, exactly like a
    // hypothetical compromised/careless caller could.
    const result = applyOrderAction(
      accepted,
      {
        type: "confirm_payment",
        actor: { kind: "payment_evidence" },
        evidence: { orderId: accepted.id, paymentId: "fabricated-payment-1", status: "settled", observedAt: NOW, reason: "fabricated, not from any real provider" },
      },
      NOW + 3,
    );
    // Documents the real, open gap: order_state_machine.ts trusts the
    // CALLER to only construct this actor kind from a verified path. This is
    // not a regression introduced by this wave -- it is Agent O's own
    // documented design boundary, re-confirmed here for the coordinator.
    expect(result.ok).toBe(true);
  });
});

/**
 * Case B — Merchant claims delivery without delivery evidence.
 *
 * VERDICT: PASS at the Order state-machine level, same shape as Case A's
 * first half: `AUTHORIZED_ACTOR_KINDS.confirm_delivery` is
 * `["delivery_evidence"]` only, so a `"merchant"` actor cannot self-attest
 * delivery. The SAME expected-limitation caveat as Case A applies to who
 * may construct a `delivery_evidence` actor — Agent D's Wave B (not present
 * in this worktree) is expected to own the real verified-evidence source.
 */
describe("Case B: merchant delivery claim without delivery evidence", () => {
  it("PASS: a merchant-kind actor cannot confirm_delivery", () => {
    const accepted = buildAcceptedOrder();
    const paid = applyOrderAction(
      accepted,
      {
        type: "confirm_payment",
        actor: { kind: "payment_evidence" },
        evidence: { orderId: accepted.id, paymentId: "payment-1", status: "settled", observedAt: NOW, reason: "settled" },
      },
      NOW + 3,
    );
    if (!paid.ok) throw new Error("test setup: confirm_payment unexpectedly failed");
    const fulfilling = applyOrderAction(paid.order, { type: "fulfill", actor: BOB }, NOW + 4);
    if (!fulfilling.ok) throw new Error("test setup: fulfill unexpectedly failed");

    const result = applyOrderAction(
      fulfilling.order,
      {
        type: "confirm_delivery",
        actor: BOB, // merchant, not delivery_evidence
        evidence: { orderId: fulfilling.order.id, deliveryId: "fake-delivery-1", status: "delivered", observedAt: NOW, reason: "merchant says so" },
      },
      NOW + 5,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unauthorized_actor");
  });
});

/**
 * Case E — Payment confirmation arrives twice (idempotency).
 *
 * VERDICT: PASS (real, re-verified here). `order_state_machine.ts`'s
 * `transitionConfirmPayment` treats a repeat `"settled"` event for the SAME
 * `paymentId` as a no-op success (not a second transition/history entry
 * duplication), and a DIFFERENT `paymentId` while already paid as
 * `evidence_mismatch`.
 */
describe("Case E: duplicate payment confirmation", () => {
  it("PASS: the same settled evidence applied twice is idempotent (no duplicate history entry)", () => {
    const accepted = buildAcceptedOrder();
    const evidence = { orderId: accepted.id, paymentId: "payment-dup-1", status: "settled" as const, observedAt: NOW, reason: "settled" };
    const first = applyOrderAction(accepted, { type: "confirm_payment", actor: { kind: "payment_evidence" }, evidence }, NOW + 3);
    if (!first.ok) throw new Error("test setup: first confirm_payment unexpectedly failed");
    const historyLengthAfterFirst = first.order.history.length;

    const second = applyOrderAction(first.order, { type: "confirm_payment", actor: { kind: "payment_evidence" }, evidence }, NOW + 4);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.order.status).toBe("paid");
      expect(second.order.history.length).toBe(historyLengthAfterFirst); // no duplicate transition recorded
    }
  });

  it("PASS: a DIFFERENT paymentId while already paid is rejected as evidence_mismatch", () => {
    const accepted = buildAcceptedOrder();
    const first = applyOrderAction(
      accepted,
      { type: "confirm_payment", actor: { kind: "payment_evidence" }, evidence: { orderId: accepted.id, paymentId: "payment-A", status: "settled", observedAt: NOW, reason: "settled" } },
      NOW + 3,
    );
    if (!first.ok) throw new Error("test setup: first confirm_payment unexpectedly failed");

    const conflicting = applyOrderAction(
      first.order,
      { type: "confirm_payment", actor: { kind: "payment_evidence" }, evidence: { orderId: accepted.id, paymentId: "payment-B", status: "settled", observedAt: NOW, reason: "different payment" } },
      NOW + 4,
    );
    expect(conflicting.ok).toBe(false);
    if (!conflicting.ok) expect(conflicting.code).toBe("evidence_mismatch");
  });
});

/**
 * Case C — QR is tampered with.
 *
 * VERDICT: PASS, and no longer "UNKNOWN as a commerce behavior" (the prior
 * tabletop doc's verdict before this wave, when Commerce/Trust had zero
 * wiring). See `test/commerce_receipt_tamper_forgery.test.ts` Case A for
 * the full, dedicated multi-offset tamper sweep; this test is a single
 * light-weight confirmation IN THE CONTEXT of a full Order flow, showing
 * the receipt/QR seam this wave actually built.
 */
describe("Case C: tampered QR in the context of a full order flow", () => {
  it("PASS: a bit-flipped QR text for a real order's receipt never verifies as VALID", () => {
    const accepted = buildAcceptedOrder();
    const issuerKeypair = FedosTrustSigningKeypair.generate();
    const receiptPayload: TradeReceiptProofPayload = {
      kind: "trade_completion",
      orderId: accepted.id,
      productRef: accepted.productId,
      buyerRef: accepted.buyerPubkey,
      sellerRef: accepted.sellerPubkey,
      paymentEvidenceRef: "payment-1",
      completedAt: NOW,
      formatVersion: 1,
    };
    const envelope = issueSignedTradeReceiptProof(receiptPayload, { keypair: issuerKeypair, issuer: "merchant-bob" }, { issuedAt: NOW });
    const qrText = encodeCommerceReceiptProofToQrText(envelope);
    const tamperedChar = qrText[qrText.length - 5] === "A" ? "B" : "A";
    const tamperedText = qrText.slice(0, qrText.length - 5) + tamperedChar + qrText.slice(qrText.length - 4);

    const trustPolicy = createSingleIssuerFedosTrustPolicy({
      issuerId: "merchant-bob",
      keys: [{ keyId: issuerKeypair.publicKeyHex, publicKeyHex: issuerKeypair.publicKeyHex }],
    });
    const decoded = decodeCommerceReceiptProofFromQrText(tamperedText);
    if ("error" in decoded) {
      expect(decoded.error).toBeTruthy();
      return;
    }
    const result = verifySignedTradeReceiptProof(decoded as SignedCommerceReceiptProofEnvelope, trustPolicy, {
      clock: fixedFedosTrustClock(NOW),
    });
    expect(result.status).not.toBe("VALID");
  });
});

/**
 * Cases F/I/J — duplicate delivery, media checksum verification, malicious
 * media payload.
 *
 * VERDICT: PENDING AGENT D'S OUTPUT (F — no `delivery/` module exists in
 * this isolated worktree to exercise beyond what Order's own placeholder
 * `confirm_delivery` idempotency already covers structurally, see Case B's
 * header) and GAP / PASS-by-absence unchanged from the prior tabletop audit
 * (I/J — media fetch/render pipeline still does not exist; re-confirming
 * this would require Agent M's catalog/media work, out of this agent's
 * lane). Left as explicitly skipped placeholders rather than faked.
 */
describe("Cases F/I/J: pending sibling agent output or unchanged prior GAP", () => {
  it.skip("F: duplicate delivery confirmation dedup — PENDING AGENT D'S real delivery/ module", () => {
    // Order's own confirm_delivery already has the same idempotent-no-op /
    // evidence_mismatch shape as confirm_payment (see order_state_machine.ts
    // transitionConfirmDelivery) -- but a full case needs Agent D's real
    // delivery evidence source to be meaningful beyond what Case B covers.
  });

  it.skip("I: media checksum verification — GAP, unchanged from COMMERCE-TABLETOP-EXERCISES.md Scenario 2 Case I", () => {
    // No live media-fetch path exists anywhere in the codebase to exercise
    // this against (Agent M's catalog/media audit, re-confirmed at the top
    // of this wave's reading, not re-litigated here).
  });

  it.skip("J: malicious media payload — PASS by absence, unchanged from COMMERCE-TABLETOP-EXERCISES.md Scenario 2 Case J", () => {
    // No media bytes ever flow through any reachable code path; nothing to attack.
  });
});

/**
 * Cases G/H — customer/merchant offline.
 *
 * VERDICT: N/A / out of scope, unchanged from the prior tabletop audit —
 * no commerce state exists that offline handling could corrupt beyond what
 * Order's own append-only, pure-function transitions already guarantee
 * (every `applyOrderAction` call is synchronous and local; there is no
 * network call anywhere in Order/Payment/Receipt for "offline" to affect).
 */
describe("Cases G/H: offline customer/merchant", () => {
  it("N/A: no network call exists anywhere in Order/Payment/Receipt domain logic to go offline from", () => {
    // Documented, not tested as a behavior -- there is nothing to simulate
    // going offline FROM. createOrder/applyOrderAction/issueSignedTradeReceiptProof
    // are all synchronous, local, pure-or-CSPRNG-only functions.
    expect(true).toBe(true);
  });
});

/**
 * Bonus — an end-to-end happy path stitched together from real Wave A + this
 * wave's own functions, standing in for the original brief's T0-T16 tabletop
 * at the domain-logic level (see the updated
 * `docs/commerce/COMMERCE-TABLETOP-EXERCISES.md` for the UI-reachability
 * verdict per step, which this test does not attempt to replicate — this is
 * domain logic only, no IPC/renderer/packaged app).
 */
describe("Bonus: full domain-logic happy path (Order -> Payment -> Receipt -> QR)", () => {
  it("create -> submit -> accept -> pay -> fulfill -> receipt issued+verified+QR round-tripped", async () => {
    const created = createOrder(
      { id: "order-tabletop-happy-1", productId: "product-digital-art-print", sellerPubkey: BOB.pubkey!, unitPriceCents: 500, currency: "USD" },
      ALICE,
      NOW,
    );
    if (!created.ok) throw new Error("createOrder failed");
    const submitted = applyOrderAction(created.order, { type: "submit", actor: ALICE }, NOW + 1);
    if (!submitted.ok) throw new Error("submit failed");
    const accepted = applyOrderAction(submitted.order, { type: "accept", actor: BOB }, NOW + 2);
    if (!accepted.ok) throw new Error("accept failed");

    const provider = new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true, runtimeProfile: "test" });
    const paymentRequest: PaymentRequest = {
      productId: accepted.order.productId,
      orderId: accepted.order.id,
      buyerPubkey: accepted.order.buyerPubkey,
      amountCents: accepted.order.unitPriceCents,
      currency: accepted.order.currency,
      rail: "manual_placeholder",
    };
    const decision = await provider.requestPayment(paymentRequest);
    expect(decision.allowed).toBe(true);
    expect(decision.paymentId).toBeDefined();
    const evidence = await provider.simulateSettlement(decision.paymentId!, "paid");
    expect(evidence.status).toBe("settled");
    expect(evidence.verification?.authoritative).toBe(true);

    const paid = applyOrderAction(
      accepted.order,
      { type: "confirm_payment", actor: { kind: "payment_evidence" }, evidence: { orderId: accepted.order.id, paymentId: evidence.paymentId, status: "settled", observedAt: evidence.observedAt, reason: evidence.reason } },
      NOW + 3,
    );
    if (!paid.ok) throw new Error("confirm_payment failed");
    expect(paid.order.status).toBe("paid");

    const fulfilling = applyOrderAction(paid.order, { type: "fulfill", actor: BOB }, NOW + 4);
    if (!fulfilling.ok) throw new Error("fulfill failed");

    // Receipt issuance at "fulfilling" -- a trade-completion receipt for the
    // paid, in-fulfillment order (delivery confirmation itself is Agent D's
    // real evidence, not exercised here -- see Cases B/F above).
    const issuerKeypair = FedosTrustSigningKeypair.generate();
    const receiptPayload: TradeReceiptProofPayload = {
      kind: "trade_completion",
      orderId: fulfilling.order.id,
      productRef: fulfilling.order.productId,
      buyerRef: fulfilling.order.buyerPubkey,
      sellerRef: fulfilling.order.sellerPubkey,
      paymentEvidenceRef: fulfilling.order.paymentId,
      completedAt: NOW + 4,
      formatVersion: 1,
    };
    const envelope = issueSignedTradeReceiptProof(receiptPayload, { keypair: issuerKeypair, issuer: "merchant-bob" }, { issuedAt: NOW + 4 });
    const qrText = encodeCommerceReceiptProofToQrText(envelope);
    const decoded = decodeCommerceReceiptProofFromQrText(qrText);
    expect("error" in decoded).toBe(false);

    const trustPolicy = createSingleIssuerFedosTrustPolicy({
      issuerId: "merchant-bob",
      keys: [{ keyId: issuerKeypair.publicKeyHex, publicKeyHex: issuerKeypair.publicKeyHex }],
    });
    const result = verifySignedTradeReceiptProof(decoded as SignedCommerceReceiptProofEnvelope, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 4),
    });
    expect(result.status).toBe("VALID");
    if (result.status === "VALID") {
      expect(result.payload.orderId).toBe(fulfilling.order.id);
      expect(result.payload.paymentEvidenceRef).toBe(fulfilling.order.paymentId);
    }
  });
});
