/**
 * Secure Runtime Alpha 492 ("Canonical Publisher Result Decision") —
 * Stage 2 of the Alpha 491–500 Canonical Publisher & Delivery
 * Observation Contract Reconciliation Arc.
 *
 * `FedosOutboundPublishResult` is the ONE canonical answer to "what
 * happened when a Publisher attempted delivery," replacing neither
 * `FedosBoardOutboxPublishResult` (`../outbox/fedos_board_outbox_publisher.ts`,
 * Alpha 473, UNCHANGED) nor `FedosNostrBoardPublisher`'s own bare
 * `boolean` (Alpha 455, UNCHANGED) — both existing contracts remain
 * exactly as they are; this is a NEW, additive, protocol-neutral shape
 * that adapters translate to and from (Alpha 496/497).
 *
 * Deliberately excludes ANY retry-policy field — retryability is a
 * SEPARATE, fixed, outcome-keyed lookup (`fedos_outbound_publish_retry_policy.ts`,
 * Alpha 497), never Publisher-supplied per-call judgment under this
 * canonical shape.
 *
 * `externalReference` is REQUIRED (non-null) for `"accepted"` — by
 * design, forcing every "accepted" claim to carry concrete evidence —
 * and nullable for `"rejected"`/`"failed"`.
 *
 * HARD GUARDRAILS (see `docs/secure_runtime_alpha_492_canonical_publisher_result_decision.md`
 * §5 for the full reasoning):
 *   - `FedosOutboundPublishResult` and `isFedosOutboundPublishResult`
 *     are the ONLY exports.
 *   - No `retryPolicy`, `reason`, `error`, or raw transport-message
 *     field of any kind — `externalReference` is the ONLY payload
 *     field beyond `outcome`.
 *   - This file performs no Observation construction, no Relay
 *     reference, no Retry reference — it is a pure type/guard module.
 */

export type FedosOutboundPublishResult =
  | { readonly outcome: "accepted"; readonly externalReference: string }
  | { readonly outcome: "rejected"; readonly externalReference: string | null }
  | { readonly outcome: "failed"; readonly externalReference: string | null };

/**
 * Structural, fail-closed guard — never throws. Rejects any extra key,
 * any non-matching `outcome`, and an `"accepted"` result whose
 * `externalReference` is not a non-empty string.
 */
export function isFedosOutboundPublishResult(value: unknown): value is FedosOutboundPublishResult {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as { outcome?: unknown; externalReference?: unknown };
  const keys = Object.keys(value);
  if (keys.length !== 2) return false;
  if (!("outcome" in candidate) || !("externalReference" in candidate)) return false;

  if (candidate.outcome === "accepted") {
    return typeof candidate.externalReference === "string" && candidate.externalReference.trim().length > 0;
  }
  if (candidate.outcome === "rejected" || candidate.outcome === "failed") {
    return candidate.externalReference === null || typeof candidate.externalReference === "string";
  }
  return false;
}
