/**
 * FedOS Commerce End-to-End Completion arc (Agent D, Wave B) — Delivery
 * domain, digital delivery artifact.
 *
 * This arc's real, non-fake E2E proof artifact (brief item 5 / §19): a
 * deterministic, downloadable text/JSON "digital receipt" the customer can
 * view once their Delivery reaches `"delivered"`. No real shipping
 * integration exists or is claimed — this produces actual bytes
 * (`DeliveryReceiptArtifact.content`), not a UI label pretending bytes
 * exist. Pure function, no I/O, no clock read internally (`generatedAt` is
 * caller-supplied) — same posture as the rest of this domain.
 */

import type { DeliveryEvidenceProvenance, DeliveryReceiptArtifact } from "./delivery_types.js";

/**
 * Builds the digital delivery receipt for a Delivery reaching `"delivered"`.
 * Deterministic: identical inputs always produce an identical
 * `DeliveryReceiptArtifact` (same `content` string byte-for-byte) — no
 * randomness, no hidden clock read, no I/O.
 */
export function buildDeliveryReceiptArtifact(params: {
  readonly deliveryId: string;
  readonly orderId: string;
  readonly deliveredAt: number;
  readonly evidenceSource: DeliveryEvidenceProvenance["source"];
  readonly reason: string;
  readonly generatedAt: number;
}): DeliveryReceiptArtifact {
  const payload = {
    kind: "fedos.commerce.delivery_receipt.v1",
    deliveryId: params.deliveryId,
    orderId: params.orderId,
    deliveredAt: params.deliveredAt,
    evidenceSource: params.evidenceSource,
    reason: params.reason,
    generatedAt: params.generatedAt,
  };
  return {
    deliveryId: params.deliveryId,
    orderId: params.orderId,
    mimeType: "application/json",
    filename: `delivery-receipt-${params.deliveryId}.json`,
    content: JSON.stringify(payload, null, 2),
    generatedAt: params.generatedAt,
  };
}
