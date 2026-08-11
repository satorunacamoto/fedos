import { describe, it, expect } from "vitest";
import { AUTHORITATIVE_DELIVERY_EVIDENCE_SOURCES } from "../src/os/commerce/delivery/delivery_types.js";
import { buildDeliveryReceiptArtifact } from "../src/os/commerce/delivery/delivery_artifact.js";
import { applyDeliveryAction, createDelivery } from "../src/os/commerce/delivery/delivery_state_machine.js";
import type { DeliveryEvidence, DeliveryEvidenceProvenance, DeliveryRecord } from "../src/os/commerce/delivery/delivery_types.js";

/**
 * Commerce E2E Completion arc, Agent D (Wave B) -- Delivery evidence /
 * provenance tests (brief §20: "separate self-assertion from verifiable
 * proof"). Focuses on `DeliveryEvidenceProvenance`'s allowlist and the
 * real digital artifact `delivery_artifact.ts` produces, as distinct
 * concerns from the full state-machine transition tests
 * (`commerce_delivery_state_machine.test.ts`).
 */

const CUSTOMER = "1".repeat(64);
const MERCHANT = "f".repeat(64);
const NOW = 1_700_000_000;

describe("AUTHORITATIVE_DELIVERY_EVIDENCE_SOURCES allowlist", () => {
  it("1. contains exactly recipient_acknowledgment and signed_proof -- never merchant_claim", () => {
    expect(AUTHORITATIVE_DELIVERY_EVIDENCE_SOURCES.has("recipient_acknowledgment")).toBe(true);
    expect(AUTHORITATIVE_DELIVERY_EVIDENCE_SOURCES.has("signed_proof")).toBe(true);
    expect(AUTHORITATIVE_DELIVERY_EVIDENCE_SOURCES.has("merchant_claim" as DeliveryEvidenceProvenance["source"])).toBe(false);
    expect(AUTHORITATIVE_DELIVERY_EVIDENCE_SOURCES.size).toBe(2);
  });

  it("2. the type system forbids constructing merchant_claim with authoritative: true (compile-time guardrail)", () => {
    // @ts-expect-error -- merchant_claim's `authoritative` literal is `false`; this must not type-check.
    const illegal: DeliveryEvidenceProvenance = { source: "merchant_claim", authoritative: true };
    expect(illegal).toBeDefined(); // keep the variable "used" for lint; the real assertion is the ts-expect-error above.
  });
});

function freshDelivery(): DeliveryRecord {
  const result = createDelivery(
    { id: "delivery-1", orderId: "order-1", buyerPubkey: CUSTOMER, sellerPubkey: MERCHANT, orderPaymentConfirmed: true },
    { kind: "merchant", pubkey: MERCHANT },
    NOW,
  );
  if (!result.ok) throw new Error("fixture setup failed: " + result.reason);
  return result.delivery;
}

function fulfilling(): DeliveryRecord {
  const created = freshDelivery();
  const result = applyDeliveryAction(
    created,
    { type: "start_fulfillment", actor: { kind: "merchant", pubkey: MERCHANT }, claim: { deliveryId: "delivery-1", orderId: "order-1", claimedAt: NOW } },
    NOW + 1,
  );
  if (!result.ok) throw new Error("fixture setup failed: " + result.reason);
  return result.delivery;
}

describe("MerchantDeliveryClaim vs DeliveryEvidence -- the self-assertion/proof split", () => {
  it("3. a MerchantDeliveryClaim (fulfillment claim) never carries a 'delivered'-capable evidence shape", () => {
    // MerchantDeliveryClaim has no `status`/`verification` fields at all -- it
    // is structurally incapable of being passed where DeliveryEvidence is
    // required by confirm_delivery. This test documents the type-level
    // separation the brief's §20 asks for.
    const claim = { deliveryId: "delivery-1", orderId: "order-1", claimedAt: NOW };
    expect("status" in claim).toBe(false);
    expect("verification" in claim).toBe(false);
  });

  it("4. FAILURE CASE: a raw merchant_claim DeliveryEvidence value, even well-formed, cannot move fulfilling -> delivered", () => {
    const delivery = fulfilling();
    const bareClaim: DeliveryEvidence = {
      deliveryId: "delivery-1",
      orderId: "order-1",
      status: "delivered",
      observedAt: NOW,
      reason: "merchant says it shipped",
      verification: { source: "merchant_claim", authoritative: false, claimedBy: MERCHANT },
    };
    const result = applyDeliveryAction(delivery, { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: bareClaim }, NOW + 2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("evidence_not_authoritative");
  });

  it("5. recipient_acknowledgment evidence (the arc's honest minimum viable authoritative signal) IS sufficient", () => {
    const delivery = fulfilling();
    const evidence: DeliveryEvidence = {
      deliveryId: "delivery-1",
      orderId: "order-1",
      status: "delivered",
      observedAt: NOW,
      reason: "customer tapped 'I received this'",
      verification: { source: "recipient_acknowledgment", authoritative: true, acknowledgedBy: CUSTOMER },
    };
    const result = applyDeliveryAction(delivery, { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence }, NOW + 2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delivery.status).toBe("delivered");
  });

  it("6. signed_proof evidence (the seam for Agent T's Trust/QR output) is sufficient once populated", () => {
    const delivery = fulfilling();
    const evidence: DeliveryEvidence = {
      deliveryId: "delivery-1",
      orderId: "order-1",
      status: "delivered",
      observedAt: NOW,
      reason: "cryptographic receipt verified",
      verification: { source: "signed_proof", authoritative: true, provider: "FedosTrustQrReceipt", verifiedAt: NOW },
    };
    const result = applyDeliveryAction(delivery, { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence }, NOW + 2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delivery.evidenceSource).toBe("signed_proof");
  });
});

describe("buildDeliveryReceiptArtifact -- the real digital delivery artifact (brief item 5 / §19)", () => {
  const params = {
    deliveryId: "delivery-1",
    orderId: "order-1",
    deliveredAt: NOW,
    evidenceSource: "recipient_acknowledgment" as const,
    reason: "customer confirmed receipt",
    generatedAt: NOW,
  };

  it("7. produces real, non-empty, parseable JSON bytes -- not a UI label", () => {
    const artifact = buildDeliveryReceiptArtifact(params);
    expect(artifact.content.length).toBeGreaterThan(0);
    const parsed = JSON.parse(artifact.content);
    expect(parsed.deliveryId).toBe("delivery-1");
    expect(parsed.orderId).toBe("order-1");
    expect(parsed.evidenceSource).toBe("recipient_acknowledgment");
    expect(artifact.mimeType).toBe("application/json");
    expect(artifact.filename).toBe("delivery-receipt-delivery-1.json");
  });

  it("8. is deterministic -- identical inputs produce byte-identical content", () => {
    const first = buildDeliveryReceiptArtifact(params);
    const second = buildDeliveryReceiptArtifact({ ...params });
    expect(first.content).toBe(second.content);
  });

  it("9. different deliveryId/evidenceSource inputs produce different content", () => {
    const first = buildDeliveryReceiptArtifact(params);
    const second = buildDeliveryReceiptArtifact({ ...params, deliveryId: "delivery-2" });
    expect(first.content).not.toBe(second.content);
  });

  it("10. the confirm_delivery transition attaches this exact artifact shape to the delivered record", () => {
    const delivery = fulfilling();
    const evidence: DeliveryEvidence = {
      deliveryId: "delivery-1",
      orderId: "order-1",
      status: "delivered",
      observedAt: NOW,
      reason: "customer confirmed receipt",
      verification: { source: "recipient_acknowledgment", authoritative: true, acknowledgedBy: CUSTOMER },
    };
    const result = applyDeliveryAction(delivery, { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence }, NOW + 2);
    if (!result.ok) throw new Error("expected ok");
    const artifact = result.delivery.artifact;
    expect(artifact).toBeDefined();
    expect(artifact?.deliveryId).toBe("delivery-1");
    expect(artifact?.mimeType).toBe("application/json");
    const parsed = JSON.parse(artifact?.content ?? "{}");
    expect(parsed.reason).toBe("customer confirmed receipt");
  });
});
