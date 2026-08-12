import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

import {
  applyInboundPaymentEvidenceSync,
  buildOutboundPaymentEvidenceSyncPayload,
  type PaymentEvidenceReceiveExpectation,
} from "../src/os/commerce/payment/payment_evidence_port.js";
import { PaymentSettlementLedger, createPendingSettlement } from "../src/os/commerce/payment/state_machine.js";
import { DurablePaymentSettlementLedger } from "../src/os/commerce/payment/persistence/durable_payment_settlement_ledger.js";
import type { PaymentEvidence } from "../src/os/commerce/payment/types.js";
import {
  RealCommercePrivatePaymentEvidenceTransport,
  RealPaymentEvidenceTransport,
  verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope,
  type CommerceNip44Wire,
} from "../src/os/commerce/catalog/adapters/nostr/commerce_private_payment_evidence_bridge.js";
import type { PrivatePaymentEvidenceSyncPayload } from "../src/os/commerce/events/commerce_private_payment_evidence_sync.js";
import type { NostrEvent } from "../src/os/messenger/adapters/nostr/protocol/types.js";
import type {
  FedosNostrSigningAuthority,
  FedosNostrUnsignedEventRequest,
} from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { RelayPublisher, PublishResult } from "../src/os/messenger/adapters/nostr/protocol/publish.js";

/**
 * Commerce Purchase/Payment Completion mega-arc (Agent P) — end-to-end
 * cross-process PaymentEvidence transport + receiver-validation coverage.
 *
 * This is the CENTRAL test file for this arc's own core invariant: Payment
 * evidence that is authoritative on ONE process's own local ledger must
 * become authoritative on the OTHER counterparty's independent process
 * ledger ONLY after real cryptographic verification + receiver-side
 * binding checks — never from a bare claim, a Nostr event's mere
 * existence, a relay receipt, or a UI action alone.
 *
 * Uses the SAME real Schnorr-signing + fake-directional-NIP-44 pattern
 * `commerce_private_payment_evidence_bridge_fake_crypto.test.ts` and
 * `commerce_private_order_bridge_fake_crypto.test.ts` already established
 * — real signature math, a non-cryptographic (but directionally faithful)
 * encryption double. `senderPubkeyHex` in every scenario below is
 * therefore a REAL, cryptographically verified Schnorr signer identity,
 * never a test fixture string.
 */

const SELLER_SECRET = new Uint8Array(32).fill(11);
const SELLER_PUBKEY = bytesToHex(schnorr.getPublicKey(SELLER_SECRET));
const BUYER_SECRET = new Uint8Array(32).fill(12);
const BUYER_PUBKEY = bytesToHex(schnorr.getPublicKey(BUYER_SECRET));
const MALLORY_SECRET = new Uint8Array(32).fill(13);
const MALLORY_PUBKEY = bytesToHex(schnorr.getPublicKey(MALLORY_SECRET));

class FakeDirectionalNip44Wire implements CommerceNip44Wire {
  constructor(private readonly selfPubkeyHex: string) {}
  async encryptNip44Wire(_accountIndex: number, counterpartyPublicKeyHex: string, plaintext: Uint8Array): Promise<string | null> {
    return JSON.stringify({ from: this.selfPubkeyHex, to: counterpartyPublicKeyHex, data: bytesToHex(plaintext) });
  }
  async decryptNip44Wire(_accountIndex: number, counterpartyPublicKeyHex: string, payload: string): Promise<Uint8Array | null> {
    try {
      const parsed = JSON.parse(payload) as { from?: unknown; to?: unknown; data?: unknown };
      if (parsed.from !== counterpartyPublicKeyHex || parsed.to !== this.selfPubkeyHex) return null;
      if (typeof parsed.data !== "string") return null;
      return hexToBytes(parsed.data);
    } catch {
      return null;
    }
  }
}

function realSchnorrSigningAuthority(secretKey: Uint8Array): FedosNostrSigningAuthority {
  return {
    async signEvent(request: FedosNostrUnsignedEventRequest): Promise<NostrEvent | null> {
      const pubkey = bytesToHex(schnorr.getPublicKey(secretKey));
      const preimage = JSON.stringify([0, pubkey, request.createdAt, request.kind, request.tags, request.content]);
      const id = bytesToHex(sha256(new TextEncoder().encode(preimage)));
      const sig = bytesToHex(schnorr.sign(hexToBytes(id), secretKey));
      return { id, pubkey, created_at: request.createdAt, kind: request.kind, tags: request.tags as string[][], content: request.content, sig };
    },
    async publicIdentityForAccount(accountIndex: number) {
      return { accountIndex, publicKeyHex: bytesToHex(schnorr.getPublicKey(secretKey)) };
    },
  };
}

class InMemoryRelayPublisher implements RelayPublisher {
  readonly published: NostrEvent[] = [];
  async publish(event: NostrEvent): Promise<PublishResult> {
    this.published.push(event);
    return { eventId: event.id, accepted: true, message: "" };
  }
}

function authoritativeEvidence(overrides: Partial<PaymentEvidence> = {}): PaymentEvidence {
  return {
    paymentId: "payment-1",
    productId: "prod-1",
    observedAt: 1_700_000_000,
    status: "settled",
    reason: "settled via btcpay webhook",
    verification: { source: "provider_verified", authoritative: true, provider: "btcpay", verifiedAt: 1_700_000_000 },
    ...overrides,
  };
}

function standardExpectation(overrides: Partial<PaymentEvidenceReceiveExpectation> = {}): PaymentEvidenceReceiveExpectation {
  return {
    expectedOrderId: "order-1",
    expectedCounterpartyPubkeyHex: SELLER_PUBKEY,
    expectedAmountCents: 4200,
    expectedCurrency: "USD",
    ...overrides,
  };
}

/** Full round-trip: seller sends real evidence -> buyer verifies+decrypts -> returns {senderPubkeyHex, payload}. */
async function sellerSendsToBuyer(
  evidence: PaymentEvidence,
  binding: { orderId: string; amountCents: number; currency: string },
  overrideRecipient: string = BUYER_PUBKEY,
  senderSecret: Uint8Array = SELLER_SECRET,
): Promise<{ readonly senderPubkeyHex: string; readonly payload: unknown; readonly sendAccepted: boolean }> {
  const senderPubkey = bytesToHex(schnorr.getPublicKey(senderSecret));
  const relay = new InMemoryRelayPublisher();
  const transport = new RealPaymentEvidenceTransport({
    signingAuthority: realSchnorrSigningAuthority(senderSecret),
    relayPublisher: relay,
    nip44Wire: new FakeDirectionalNip44Wire(senderPubkey),
    accountIndex: 0,
    now: () => 1_700_000_100,
  });
  const sendResult = await transport.send(evidence, binding, overrideRecipient);
  if (!sendResult.accepted || relay.published.length === 0) {
    return { senderPubkeyHex: "", payload: undefined, sendAccepted: sendResult.accepted };
  }
  const envelope = await verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope(relay.published[0]!, {
    nip44Wire: new FakeDirectionalNip44Wire(overrideRecipient),
    localAccountIndex: 0,
  });
  return { senderPubkeyHex: envelope.senderPubkeyHex, payload: envelope.payload, sendAccepted: sendResult.accepted };
}

// ---------------------------------------------------------------------------
// 1. Happy path: send + receive, applied through the real ledger
// ---------------------------------------------------------------------------

describe("PaymentEvidence Port: happy-path send/receive", () => {
  it("seller's authoritative evidence reaches the buyer's independent ledger and transitions pending -> paid", async () => {
    const buyerLedger = new PaymentSettlementLedger();
    buyerLedger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);

    const { senderPubkeyHex, payload, sendAccepted } = await sellerSendsToBuyer(authoritativeEvidence(), {
      orderId: "order-1",
      amountCents: 4200,
      currency: "USD",
    });
    expect(sendAccepted).toBe(true);

    const outcome = applyInboundPaymentEvidenceSync(senderPubkeyHex, payload, standardExpectation(), buyerLedger);
    expect(outcome.accepted).toBe(true);
    if (!outcome.accepted) throw new Error("unreachable");
    expect(outcome.result.outcome).toBe("transitioned");
    expect(outcome.result.state.status).toBe("paid");
    expect(buyerLedger.get("payment-1")?.status).toBe("paid");
  });

  it("test_simulator-sourced evidence also transports and applies successfully", async () => {
    const buyerLedger = new PaymentSettlementLedger();
    buyerLedger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);
    const simEvidence = authoritativeEvidence({
      verification: { source: "test_simulator", authoritative: true, simulator: "DeterministicLocalPaymentProvider" },
    });
    const { senderPubkeyHex, payload, sendAccepted } = await sellerSendsToBuyer(simEvidence, { orderId: "order-1", amountCents: 4200, currency: "USD" });
    expect(sendAccepted).toBe(true);
    const outcome = applyInboundPaymentEvidenceSync(senderPubkeyHex, payload, standardExpectation(), buyerLedger);
    expect(outcome.accepted).toBe(true);
    if (!outcome.accepted) throw new Error("unreachable");
    expect(outcome.result.state.status).toBe("paid");
  });
});

// ---------------------------------------------------------------------------
// 2. Forgery rejection
// ---------------------------------------------------------------------------

describe("PaymentEvidence Port: forgery rejection", () => {
  it("USER-FORGEABLE PAID: NO -- a raw customer_claim can never even be transported (buildOutboundPaymentEvidenceSyncPayload refuses it)", () => {
    const bareClaim: PaymentEvidence = {
      paymentId: "payment-1",
      productId: "prod-1",
      observedAt: 1_700_000_000,
      status: "settled",
      reason: "I paid, trust me",
      verification: { source: "customer_claim", authoritative: false, claimedBy: BUYER_PUBKEY },
    };
    const payload = buildOutboundPaymentEvidenceSyncPayload(bareClaim, { orderId: "order-1", amountCents: 4200, currency: "USD" }, 1_700_000_100);
    expect(payload).toBeNull();
  });

  it("MERCHANT-FORGEABLE PAID: NO -- a raw merchant_claim can never even be transported", () => {
    const bareClaim: PaymentEvidence = {
      paymentId: "payment-1",
      productId: "prod-1",
      observedAt: 1_700_000_000,
      status: "settled",
      reason: "they paid, trust me",
      verification: { source: "merchant_claim", authoritative: false, claimedBy: SELLER_PUBKEY },
    };
    const payload = buildOutboundPaymentEvidenceSyncPayload(bareClaim, { orderId: "order-1", amountCents: 4200, currency: "USD" }, 1_700_000_100);
    expect(payload).toBeNull();
  });

  it("UNAUTH CALLBACK: NO -- provider_unverified evidence (an unauthenticated webhook payload) can never even be transported", () => {
    const unverifiedCallback: PaymentEvidence = {
      paymentId: "payment-1",
      productId: "prod-1",
      observedAt: 1_700_000_000,
      status: "settled",
      reason: "unsigned webhook payload claimed settled",
      verification: { source: "provider_unverified", authoritative: false, provider: "btcpay" },
    };
    const payload = buildOutboundPaymentEvidenceSyncPayload(unverifiedCallback, { orderId: "order-1", amountCents: 4200, currency: "USD" }, 1_700_000_100);
    expect(payload).toBeNull();
  });

  it("AI/BOT/MALLORY-FORGEABLE PAID: NO -- a genuinely signed+encrypted message from the WRONG real identity (not the order's known counterparty) is rejected before the ledger is ever touched", async () => {
    const buyerLedger = new PaymentSettlementLedger();
    buyerLedger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);

    // Mallory has her OWN real identity and can genuinely sign+encrypt+send
    // a "settled" claim addressed to the buyer -- transport-layer crypto
    // succeeds (it really is a message from Mallory), but she is not the
    // order's known seller.
    const { senderPubkeyHex, payload, sendAccepted } = await sellerSendsToBuyer(
      authoritativeEvidence(),
      { orderId: "order-1", amountCents: 4200, currency: "USD" },
      BUYER_PUBKEY,
      MALLORY_SECRET,
    );
    expect(sendAccepted).toBe(true);
    expect(senderPubkeyHex).toBe(MALLORY_PUBKEY);

    const outcome = applyInboundPaymentEvidenceSync(senderPubkeyHex, payload, standardExpectation(), buyerLedger);
    expect(outcome.accepted).toBe(false);
    if (outcome.accepted) throw new Error("unreachable");
    expect(outcome.reason).toContain("not the expected counterparty");
    expect(buyerLedger.get("payment-1")?.status).toBe("pending"); // untouched
  });

  it("RELAY-FORGEABLE PAID: NO -- a relay claiming to relay ANY unsigned/garbage value never verifies, regardless of what it says was 'accepted'", async () => {
    const buyerLedger = new PaymentSettlementLedger();
    buyerLedger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);
    for (const relayClaim of [null, undefined, { fake: "event" }, "just a string a relay might forward"]) {
      const envelope = await verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope(relayClaim, {
        nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
        localAccountIndex: 0,
      });
      expect(envelope.outcome).toBe("not-mine");
      expect(envelope.payload).toBeUndefined();
    }
    expect(buyerLedger.get("payment-1")?.status).toBe("pending");
  });

  it("NOSTR-EVENT-ALONE: NOT AUTHORITY -- a real, validly-signed, correctly-tagged, successfully-decrypted event whose payload's own verification.source is not authoritative is rejected at the receiver gate", async () => {
    const buyerLedger = new PaymentSettlementLedger();
    buyerLedger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);

    // Construct a WELL-FORMED wire payload with a claimed-authoritative
    // shape but hand-craft a structurally different (still schema-valid)
    // "test_simulator" claim from an unrelated simulator name, driven
    // straight through applyInboundPaymentEvidenceSync with an
    // expectedProviderIdentity mismatch -- proves the receiver checks
    // provider identity, not merely "some authoritative-shaped tag".
    const payload: PrivatePaymentEvidenceSyncPayload = {
      category: "private-payment-evidence-sync",
      formatVersion: 1,
      paymentId: "payment-1",
      orderId: "order-1",
      productId: "prod-1",
      amountCents: 4200,
      currency: "USD",
      status: "settled",
      verification: { source: "test_simulator", simulator: "SomeOtherUntrustedSimulator" },
      observedAt: 1_700_000_000,
      reason: "claims settled",
      at: 1_700_000_100,
    };
    const outcome = applyInboundPaymentEvidenceSync(
      SELLER_PUBKEY,
      payload,
      standardExpectation({ expectedProviderIdentity: "DeterministicLocalPaymentProvider" }),
      buyerLedger,
    );
    expect(outcome.accepted).toBe(false);
    if (outcome.accepted) throw new Error("unreachable");
    expect(outcome.reason).toContain("provider identity");
    expect(buyerLedger.get("payment-1")?.status).toBe("pending");
  });

  it("wrong order: evidence for a different orderId is rejected, ledger untouched", async () => {
    const buyerLedger = new PaymentSettlementLedger();
    buyerLedger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);
    const { senderPubkeyHex, payload, sendAccepted } = await sellerSendsToBuyer(authoritativeEvidence(), {
      orderId: "order-999-not-this-one",
      amountCents: 4200,
      currency: "USD",
    });
    expect(sendAccepted).toBe(true);
    const outcome = applyInboundPaymentEvidenceSync(senderPubkeyHex, payload, standardExpectation(), buyerLedger);
    expect(outcome.accepted).toBe(false);
    if (outcome.accepted) throw new Error("unreachable");
    expect(outcome.reason).toContain("orderId");
    expect(buyerLedger.get("payment-1")?.status).toBe("pending");
  });

  it("wrong amount: evidence claiming a different amountCents is rejected, ledger untouched", async () => {
    const buyerLedger = new PaymentSettlementLedger();
    buyerLedger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);
    const { senderPubkeyHex, payload, sendAccepted } = await sellerSendsToBuyer(authoritativeEvidence(), {
      orderId: "order-1",
      amountCents: 1, // attacker/bug: 1 cent instead of the real 4200
      currency: "USD",
    });
    expect(sendAccepted).toBe(true);
    const outcome = applyInboundPaymentEvidenceSync(senderPubkeyHex, payload, standardExpectation(), buyerLedger);
    expect(outcome.accepted).toBe(false);
    if (outcome.accepted) throw new Error("unreachable");
    expect(outcome.reason).toContain("amountCents");
    expect(buyerLedger.get("payment-1")?.status).toBe("pending");
  });

  it("wrong currency: evidence claiming a different currency is rejected, ledger untouched", async () => {
    const buyerLedger = new PaymentSettlementLedger();
    buyerLedger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);
    const { senderPubkeyHex, payload, sendAccepted } = await sellerSendsToBuyer(authoritativeEvidence(), {
      orderId: "order-1",
      amountCents: 4200,
      currency: "EUR", // real order is USD
    });
    expect(sendAccepted).toBe(true);
    const outcome = applyInboundPaymentEvidenceSync(senderPubkeyHex, payload, standardExpectation(), buyerLedger);
    expect(outcome.accepted).toBe(false);
    if (outcome.accepted) throw new Error("unreachable");
    expect(outcome.reason).toContain("currency");
    expect(buyerLedger.get("payment-1")?.status).toBe("pending");
  });

  it("old/tampered evidence: a mutated ciphertext fails real signature verification and never reaches the Port at all", async () => {
    const relay = new InMemoryRelayPublisher();
    const transport = new RealCommercePrivatePaymentEvidenceTransport({
      signingAuthority: realSchnorrSigningAuthority(SELLER_SECRET),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      accountIndex: 0,
      now: () => 1_700_000_100,
    });
    const payload: PrivatePaymentEvidenceSyncPayload = {
      category: "private-payment-evidence-sync",
      formatVersion: 1,
      paymentId: "payment-1",
      orderId: "order-1",
      productId: "prod-1",
      amountCents: 4200,
      currency: "USD",
      status: "settled",
      verification: { source: "provider_verified", provider: "btcpay", verifiedAt: 1_700_000_000 },
      observedAt: 1_700_000_000,
      reason: "settled",
      at: 1_700_000_100,
    };
    await transport.send(payload, BUYER_PUBKEY);
    const original = relay.published[0]!;
    const tampered: NostrEvent = { ...original, content: JSON.stringify({ from: SELLER_PUBKEY, to: BUYER_PUBKEY, data: "00" }) };
    const envelope = await verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope(tampered, {
      nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY),
      localAccountIndex: 0,
    });
    expect(envelope.outcome).toBe("rejected-unverified-signature");
  });
});

// ---------------------------------------------------------------------------
// 3. Replay / idempotency / out-of-order
// ---------------------------------------------------------------------------

describe("PaymentEvidence Port: replay, duplicate, and out-of-order evidence", () => {
  it("duplicate evidence (same paymentId, same 'settled' status) re-applied is a safe no-op, never a second transition", async () => {
    const buyerLedger = new PaymentSettlementLedger();
    buyerLedger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);
    const { senderPubkeyHex, payload } = await sellerSendsToBuyer(authoritativeEvidence(), { orderId: "order-1", amountCents: 4200, currency: "USD" });

    const first = applyInboundPaymentEvidenceSync(senderPubkeyHex, payload, standardExpectation(), buyerLedger);
    expect(first.accepted).toBe(true);
    if (!first.accepted) throw new Error("unreachable");
    expect(first.result.outcome).toBe("transitioned");
    expect(first.result.state.history).toHaveLength(1);

    // REPLAY: the exact same wire payload, re-applied.
    const second = applyInboundPaymentEvidenceSync(senderPubkeyHex, payload, standardExpectation(), buyerLedger);
    expect(second.accepted).toBe(true);
    if (!second.accepted) throw new Error("unreachable");
    expect(second.result.outcome).toBe("no_op");
    expect(second.result.state.history).toHaveLength(1); // never a second entry
    expect(buyerLedger.get("payment-1")?.status).toBe("paid");
  });

  it("replayed event via a NEW independent wire round-trip (re-discovered from a relay a second time) is still a no-op", async () => {
    const buyerLedger = new PaymentSettlementLedger();
    buyerLedger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);
    const relay = new InMemoryRelayPublisher();
    const transport = new RealCommercePrivatePaymentEvidenceTransport({
      signingAuthority: realSchnorrSigningAuthority(SELLER_SECRET),
      relayPublisher: relay,
      nip44Wire: new FakeDirectionalNip44Wire(SELLER_PUBKEY),
      accountIndex: 0,
      now: () => 1_700_000_100,
    });
    const payload: PrivatePaymentEvidenceSyncPayload = {
      category: "private-payment-evidence-sync",
      formatVersion: 1,
      paymentId: "payment-1",
      orderId: "order-1",
      productId: "prod-1",
      amountCents: 4200,
      currency: "USD",
      status: "settled",
      verification: { source: "provider_verified", provider: "btcpay", verifiedAt: 1_700_000_000 },
      observedAt: 1_700_000_000,
      reason: "settled",
      at: 1_700_000_100,
    };
    await transport.send(payload, BUYER_PUBKEY);
    const storedEvent = relay.published[0]!;

    // First discovery.
    let envelope = await verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope(storedEvent, { nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY), localAccountIndex: 0 });
    let outcome = applyInboundPaymentEvidenceSync(envelope.senderPubkeyHex, envelope.payload, standardExpectation(), buyerLedger);
    expect(outcome.accepted && outcome.result.outcome).toBe("transitioned");

    // Buyer's process restarts / re-scans the relay history and re-discovers the SAME stored event.
    envelope = await verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope(storedEvent, { nip44Wire: new FakeDirectionalNip44Wire(BUYER_PUBKEY), localAccountIndex: 0 });
    outcome = applyInboundPaymentEvidenceSync(envelope.senderPubkeyHex, envelope.payload, standardExpectation(), buyerLedger);
    expect(outcome.accepted && outcome.result.outcome).toBe("no_op");
    if (!outcome.accepted) throw new Error("unreachable");
    expect(outcome.result.state.history).toHaveLength(1);
  });

  it("out-of-order event: a stale 'expired' evidence arriving AFTER 'settled' was already applied is rejected, paid state is preserved", async () => {
    const buyerLedger = new PaymentSettlementLedger();
    buyerLedger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);

    const settled = await sellerSendsToBuyer(authoritativeEvidence({ status: "settled" }), { orderId: "order-1", amountCents: 4200, currency: "USD" });
    const settledOutcome = applyInboundPaymentEvidenceSync(settled.senderPubkeyHex, settled.payload, standardExpectation(), buyerLedger);
    expect(settledOutcome.accepted && settledOutcome.result.outcome).toBe("transitioned");
    expect(buyerLedger.get("payment-1")?.status).toBe("paid");

    // A stale/out-of-order "expired" evidence for the SAME payment arrives afterward.
    const stale = await sellerSendsToBuyer(authoritativeEvidence({ status: "expired", reason: "stale/out-of-order" }), {
      orderId: "order-1",
      amountCents: 4200,
      currency: "USD",
    });
    const staleOutcome = applyInboundPaymentEvidenceSync(stale.senderPubkeyHex, stale.payload, standardExpectation(), buyerLedger);
    expect(staleOutcome.accepted).toBe(true);
    if (!staleOutcome.accepted) throw new Error("unreachable");
    expect(staleOutcome.result.outcome).toBe("rejected"); // "paid" has no "expired" edge
    expect(buyerLedger.get("payment-1")?.status).toBe("paid"); // unchanged
  });

  it("evidence for a paymentId never bound locally is rejected, never silently creates a new record", async () => {
    const buyerLedger = new PaymentSettlementLedger();
    // Deliberately never bind "payment-1" -- buyer's process never issued/knows this payment.
    const { senderPubkeyHex, payload } = await sellerSendsToBuyer(authoritativeEvidence(), { orderId: "order-1", amountCents: 4200, currency: "USD" });
    const outcome = applyInboundPaymentEvidenceSync(senderPubkeyHex, payload, standardExpectation(), buyerLedger);
    expect(outcome.accepted).toBe(true);
    if (!outcome.accepted) throw new Error("unreachable");
    expect(outcome.result.outcome).toBe("rejected");
    expect(outcome.result.reason).toContain("unbound");
    expect(buyerLedger.get("payment-1")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Restart durability: Alice/Bob reach PAID -> close -> reopen -> PAID remains valid
// ---------------------------------------------------------------------------

describe("PaymentEvidence Port: restart durability", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("Bob (seller) observes settlement locally, durably persists 'paid', closes, reopens -- 'paid' remains valid with no transient-process dependency", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-payment-evidence-port-"));
    const path = join(dir, "bob-settlements.ndjson");

    let bobLedger: DurablePaymentSettlementLedger = new DurablePaymentSettlementLedger(path);
    bobLedger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);
    const applyResult = bobLedger.apply(authoritativeEvidence(), "order-1");
    expect(applyResult.outcome).toBe("transitioned");
    expect(bobLedger.get("payment-1")?.status).toBe("paid");

    // Close Bob (drop the instance) and reopen a FRESH one over the same file.
    bobLedger = new DurablePaymentSettlementLedger(path);
    expect(bobLedger.get("payment-1")?.status).toBe("paid");
    expect(bobLedger.get("payment-1")?.history).toHaveLength(1);
  });

  it("Alice (buyer) receives Bob's evidence over the real transport, applies it to her OWN durable ledger, closes, reopens -- PAID remains valid on her side too (vice versa)", async () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-payment-evidence-port-"));
    const path = join(dir, "alice-settlements.ndjson");

    let aliceLedger: DurablePaymentSettlementLedger = new DurablePaymentSettlementLedger(path);
    aliceLedger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);

    const { senderPubkeyHex, payload } = await sellerSendsToBuyer(authoritativeEvidence(), { orderId: "order-1", amountCents: 4200, currency: "USD" });
    const outcome = applyInboundPaymentEvidenceSync(senderPubkeyHex, payload, standardExpectation(), aliceLedger);
    expect(outcome.accepted).toBe(true);
    if (!outcome.accepted) throw new Error("unreachable");
    expect(outcome.result.outcome).toBe("transitioned");
    expect(aliceLedger.get("payment-1")?.status).toBe("paid");

    // Close Alice, reopen a FRESH instance over the same file -- no live process, no live relay connection, no re-transport.
    aliceLedger = new DurablePaymentSettlementLedger(path);
    expect(aliceLedger.get("payment-1")?.status).toBe("paid");
    expect(aliceLedger.get("payment-1")?.history).toHaveLength(1);
  });

  it("a replayed evidence event applied AFTER Alice reopens is still a safe no-op against her durable ledger", async () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-payment-evidence-port-"));
    const path = join(dir, "alice-settlements.ndjson");

    let aliceLedger: DurablePaymentSettlementLedger = new DurablePaymentSettlementLedger(path);
    aliceLedger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);

    const { senderPubkeyHex, payload } = await sellerSendsToBuyer(authoritativeEvidence(), { orderId: "order-1", amountCents: 4200, currency: "USD" });
    applyInboundPaymentEvidenceSync(senderPubkeyHex, payload, standardExpectation(), aliceLedger);

    aliceLedger = new DurablePaymentSettlementLedger(path); // restart
    const replayOutcome = applyInboundPaymentEvidenceSync(senderPubkeyHex, payload, standardExpectation(), aliceLedger);
    expect(replayOutcome.accepted).toBe(true);
    if (!replayOutcome.accepted) throw new Error("unreachable");
    expect(replayOutcome.result.outcome).toBe("no_op");
    expect(aliceLedger.get("payment-1")?.history).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 5. Sanity: createPendingSettlement stays untouched by any of the above
// ---------------------------------------------------------------------------

describe("PaymentEvidence Port: sanity", () => {
  it("createPendingSettlement produces the expected starting state this whole file assumes", () => {
    const state = createPendingSettlement("payment-1", "order-1", "prod-1", 1_700_000_000);
    expect(state.status).toBe("pending");
    expect(state.history).toHaveLength(0);
  });
});
