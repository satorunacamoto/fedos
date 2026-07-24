/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Safe Status and Aggregation.
 *
 * Phase M — framework-neutral DTOs a future UI/CLI could show directly.
 * Never exposes a signature, a raw path, or an internal `bodyHash` —
 * every builder here reads ONLY the already-safe fields of this Arc's
 * own durable/acknowledgement records.
 */

import type { FedosDeletionRequestLifecycleState } from "./fedos_deletion_request_lifecycle_state.js";
import type { FedosDeletionRequestAcknowledgementOutcome } from "./fedos_deletion_request_acknowledgement_outcome.js";

export type FedosDeletionRequestSafeStatus =
  | "draft"
  | "ready-to-deliver"
  | "pending"
  | "expired"
  | "rejected"
  | "acknowledged-local-history"
  | "acknowledged-local-history-and-index"
  | "partial"
  | "failed"
  | "unknown";

/** Maps a REQUESTER's own local lifecycle state (plus, once acknowledged, the real ack outcome) onto the safe public status. */
export function safeStatusForFedosDeletionRequestLifecycle(
  lifecycleState: FedosDeletionRequestLifecycleState,
  acknowledgementOutcome: FedosDeletionRequestAcknowledgementOutcome | null,
): FedosDeletionRequestSafeStatus {
  switch (lifecycleState) {
    case "draft":
      return "draft";
    case "signed":
      return "ready-to-deliver";
    case "pending-delivery":
    case "delivered":
    case "recipient-evaluating":
      return "pending";
    case "expired":
      return "expired";
    case "rejected":
    case "cancelled":
      return "rejected";
    case "failed":
      return "failed";
    case "acknowledged":
      return safeStatusForFedosDeletionAcknowledgementOutcome(acknowledgementOutcome ?? "failed");
  }
}

export function safeStatusForFedosDeletionAcknowledgementOutcome(outcome: FedosDeletionRequestAcknowledgementOutcome): FedosDeletionRequestSafeStatus {
  switch (outcome) {
    case "applied-local-history":
      return "acknowledged-local-history";
    case "applied-local-history-and-index":
      return "acknowledged-local-history-and-index";
    case "applied-partial":
      return "partial";
    case "rejected-policy":
    case "unauthorized":
    case "unsupported-scope":
    case "invalid":
      return "rejected";
    case "expired":
      return "expired";
    case "failed":
      return "failed";
    case "accepted-pending":
      return "pending";
  }
}

export interface FedosDeletionRequestDeviceStatusView {
  readonly deviceRef: string | null;
  readonly status: FedosDeletionRequestSafeStatus;
}

export interface FedosDeletionRequestAggregateStatusView {
  readonly requestId: string;
  /** One entry per DISTINCT `respondingDeviceRef` this requester's own local view has actually received an acknowledgement from — restated: NEVER a full account roster, since no per-Device wire address exists (review Doc 05) to enumerate one from. */
  readonly perDevice: readonly FedosDeletionRequestDeviceStatusView[];
  /**
   * A coarse, HONEST summary of the `perDevice` list — restated,
   * unconditionally: this value NEVER means "every Device of the
   * account" and NEVER implies Archive/backup/Relay copies were
   * affected. `"unknown"` when `perDevice` is empty (nothing has been
   * heard from yet).
   */
  readonly aggregate: FedosDeletionRequestSafeStatus;
}

/**
 * Builds a requester-side aggregate view from zero or more per-Device
 * acknowledgement outcomes already durably recorded locally. Unknown/
 * offline Devices are simply ABSENT from `perDevice` — never
 * synthesized as a fabricated "unknown" row per hypothetical Device.
 */
export function buildFedosDeletionRequestAggregateStatusView(
  requestId: string,
  perDeviceOutcomes: readonly { readonly deviceRef: string | null; readonly outcome: FedosDeletionRequestAcknowledgementOutcome }[],
): FedosDeletionRequestAggregateStatusView {
  const perDevice: FedosDeletionRequestDeviceStatusView[] = perDeviceOutcomes.map((entry) => ({
    deviceRef: entry.deviceRef,
    status: safeStatusForFedosDeletionAcknowledgementOutcome(entry.outcome),
  }));

  if (perDevice.length === 0) return { requestId, perDevice, aggregate: "unknown" };

  const allSame = perDevice.every((d) => d.status === perDevice[0]!.status);
  const aggregate: FedosDeletionRequestSafeStatus = allSame ? perDevice[0]!.status : "partial";
  return { requestId, perDevice, aggregate };
}
