/**
 * Secure Runtime Alpha 497 ("Scheduler Contract Rewiring") — Stage 7 of
 * the Alpha 491–500 Canonical Publisher & Delivery Observation Contract
 * Reconciliation Arc.
 *
 * Converts the canonical `FedosOutboundPublishResult`
 * (`./fedos_outbound_publish_result.js`, Alpha 492) into the EXISTING,
 * UNCHANGED `FedosBoardOutboxPublishResult`
 * (`../outbox/fedos_board_outbox_publisher.js`, Alpha 473) —
 * `FedosPublishScheduler`'s (Alpha 476, UNCHANGED) own required input
 * shape. This is the LAST step of any canonical-result-producing
 * Publisher adapter (`FedosNostrBoardPublisherAdapter`, Alpha 496) on
 * its way to satisfying `FedosBoardOutboxPublisher.publish()`.
 *
 * Outcome rename: `"accepted"` -> `"delivered"` (the ONLY existing
 * outcome name this Arc's own canonical vocabulary does not reuse
 * verbatim — Alpha 492 §3's own rename, reversed here on the way back
 * out); `"rejected"`/`"failed"` pass through verbatim (Alpha 491 §5's
 * own already-shared names). `retryPolicy` comes from
 * `outboundPublishOutcomeToRetryPolicy` (`./fedos_outbound_publish_result_retry_policy.js`,
 * this same Stage) — never invented here. `reason` is left `undefined`
 * — `externalReference` is not prose and is never coerced into one.
 *
 * HARD GUARDRAILS:
 *   - `outboundPublishResultToFedosBoardOutboxPublishResult` is the
 *     ONLY export.
 *   - Pure, synchronous — no Relay, Observation, Scheduler, or
 *     protocol-specific reference of any kind.
 */

import type { FedosOutboundPublishResult } from "./fedos_outbound_publish_result.js";
import type { FedosBoardOutboxPublishResult } from "../outbox/fedos_board_outbox_publisher.js";
import { outboundPublishOutcomeToRetryPolicy } from "./fedos_outbound_publish_result_retry_policy.js";

export function outboundPublishResultToFedosBoardOutboxPublishResult(
  result: FedosOutboundPublishResult,
): FedosBoardOutboxPublishResult {
  const outcome = result.outcome === "accepted" ? "delivered" : result.outcome;
  return {
    outcome,
    retryPolicy: outboundPublishOutcomeToRetryPolicy(result.outcome),
  };
}
