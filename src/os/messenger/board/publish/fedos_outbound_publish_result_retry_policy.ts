/**
 * Secure Runtime Alpha 497 ("Scheduler Contract Rewiring") — Stage 7 of
 * the Alpha 491–500 Canonical Publisher & Delivery Observation Contract
 * Reconciliation Arc.
 *
 * The ONE fixed, protocol-neutral lookup from a canonical
 * `FedosOutboundPublishResult["outcome"]` (`./fedos_outbound_publish_result.js`,
 * Alpha 492) to the EXISTING `FedosBoardOutboxRetryPolicy`
 * (`../outbox/fedos_board_outbox_publisher.js`, Alpha 474, UNCHANGED) —
 * "retry directiveは既存policyから得る" (this Arc's own requirement),
 * reused verbatim, never a new algorithm:
 *
 *   - `"accepted"` -> `"never"` — already succeeded, nothing to retry.
 *   - `"rejected"` -> `"never"` — an explicit negative signal; retrying
 *     the identical content will not change a counterparty's own
 *     explicit refusal (mirrors Alpha 474 §4's own "abandoned" rationale).
 *   - `"failed"` -> `"later"` — the safest default for an
 *     unknown/generic attempt failure: worth a future `tick()`'s own
 *     retry, without this table itself computing a delay, an attempt
 *     count, or any backoff of any kind.
 *
 * This table replaces the PER-CALL, protocol-aware transience judgment
 * `FedosBoardOutboxPublishResult.retryPolicy` used to require from each
 * Publisher (Alpha 474 §3) with ONE static, universal default — the
 * direct, necessary consequence of Alpha 492's own decision to exclude
 * `retryPolicy` from the canonical result entirely. Any future protocol
 * adapter reuses this SAME table; none may define its own.
 *
 * HARD GUARDRAILS:
 *   - `outboundPublishOutcomeToRetryPolicy` is the ONLY export.
 *   - Pure, synchronous, a plain three-entry lookup — no numeric delay,
 *     no attempt counter, no backoff computation of any kind.
 */

import type { FedosOutboundPublishResult } from "./fedos_outbound_publish_result.js";
import type { FedosBoardOutboxRetryPolicy } from "../outbox/fedos_board_outbox_publisher.js";

const OUTCOME_TO_RETRY_POLICY: Readonly<Record<FedosOutboundPublishResult["outcome"], FedosBoardOutboxRetryPolicy>> = Object.freeze({
  accepted: "never",
  rejected: "never",
  failed: "later",
});

export function outboundPublishOutcomeToRetryPolicy(
  outcome: FedosOutboundPublishResult["outcome"],
): FedosBoardOutboxRetryPolicy {
  return OUTCOME_TO_RETRY_POLICY[outcome];
}
