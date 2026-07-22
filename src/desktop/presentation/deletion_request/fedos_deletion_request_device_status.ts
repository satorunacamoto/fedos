/**
 * Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-Device
 * Aggregation and User Consent UI Arc) — Phase B: the closed, deterministic
 * per-Device and account-level aggregation model over the completed durable
 * Device-specific request/acknowledgement facts. Pure functions only — no
 * Shell call, no persistence, no mutation lives in this file.
 *
 * Never produces `"deleted-everywhere"`/`"account-deleted"`/`"all-copies-erased"`/
 * `"cryptographically-erased"` — no branch in either function below can
 * reach a value outside its own closed return type, and neither closed
 * type contains one of those strings.
 */
import type { FedosPersistedDeletionRequestStateRecordV1 } from "../../../conversation/deletion_request/fedos_persisted_deletion_request_state_record_v1.js";
import type { FedosDeletionRequestAcknowledgementOutcome } from "../../../conversation/deletion_request/fedos_deletion_request_acknowledgement_outcome.js";
import type { FedosDeviceTrustState } from "../../../device/fedos_device_binding.js";

export type FedosDeletionRequestDeviceStatus =
  | "not-requested"
  | "draft"
  | "pending-delivery"
  | "relay-acknowledged"
  | "recipient-received"
  | "awaiting-recipient-decision"
  | "approved"
  | "rejected"
  | "applied-local-history"
  | "applied-local-history-and-index"
  | "partially-applied"
  | "expired"
  | "failed"
  | "revoked-device"
  | "unknown-device"
  | "offline-or-unobserved"
  | "unverifiable";

export const FEDOS_DELETION_REQUEST_DEVICE_STATUSES: readonly FedosDeletionRequestDeviceStatus[] = [
  "not-requested",
  "draft",
  "pending-delivery",
  "relay-acknowledged",
  "recipient-received",
  "awaiting-recipient-decision",
  "approved",
  "rejected",
  "applied-local-history",
  "applied-local-history-and-index",
  "partially-applied",
  "expired",
  "failed",
  "revoked-device",
  "unknown-device",
  "offline-or-unobserved",
  "unverifiable",
];

/** `"not-in-registry"` — this local sender's own Device Registry has no binding at all for the Device (distinct from `"revoked"`, a KNOWN, once-trusted Device). */
export type FedosDeletionRequestDeviceTrustFact = FedosDeviceTrustState | "not-in-registry";

/**
 * A Device's own row in the sender-side aggregate — one per known/addressed
 * Device, never a fabricated row for a hypothetical Device this sender has
 * no fact about at all.
 */
export interface FedosDeletionRequestPerDeviceRow {
  readonly deviceId: string;
  readonly status: FedosDeletionRequestDeviceStatus;
  readonly requestId: string | null;
}

/**
 * Pure per-Device status derivation. `request` is this sender's own latest
 * durable snapshot for the ONE request addressed to `deviceId` (or `null` if
 * none was ever created). `ackOutcome` is the real, already-received
 * acknowledgement outcome for that same request (or `null` if none has
 * arrived yet). `trustFact` is this LOCAL sender's own real Device Registry
 * knowledge — never invented.
 */
export function fedosDeletionRequestDeviceStatus(
  request: FedosPersistedDeletionRequestStateRecordV1 | null,
  ackOutcome: FedosDeletionRequestAcknowledgementOutcome | null,
  trustFact: FedosDeletionRequestDeviceTrustFact,
): FedosDeletionRequestDeviceStatus {
  if (trustFact === "revoked") return "revoked-device";
  if (trustFact === "not-in-registry") return "unknown-device";
  if (request === null) return "not-requested";

  if (ackOutcome !== null) {
    switch (ackOutcome) {
      case "applied-local-history":
        return "applied-local-history";
      case "applied-local-history-and-index":
        return "applied-local-history-and-index";
      case "applied-partial":
        return "partially-applied";
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
        return "awaiting-recipient-decision";
    }
  }

  switch (request.lifecycleState) {
    case "draft":
      return "draft";
    case "signed":
    case "pending-delivery":
      return "pending-delivery";
    case "delivered":
      return "relay-acknowledged";
    case "recipient-evaluating":
      return "awaiting-recipient-decision";
    case "acknowledged":
      // Reached "acknowledged" durably but no ackOutcome was supplied to this pure function --
      // structurally unreachable given the caller's own real data flow, but this function fails
      // closed to an honest "cannot independently verify" rather than fabricating a claim.
      return "unverifiable";
    case "expired":
      return "expired";
    case "rejected":
    case "cancelled":
      return "rejected";
    case "failed":
      return "failed";
  }
}

// ---------------------------------------------------------------------
// Account-level aggregate.
// ---------------------------------------------------------------------

export type FedosDeletionRequestAccountAggregateStatus =
  | "no-device-requests"
  | "some-devices-pending"
  | "some-devices-applied"
  | "all-known-devices-responded"
  | "mixed-outcomes"
  | "no-known-device-confirmed"
  | "remote-copies-unverifiable";

const APPLIED_STATUSES: ReadonlySet<FedosDeletionRequestDeviceStatus> = new Set(["applied-local-history", "applied-local-history-and-index", "partially-applied"]);
const TERMINAL_STATUSES: ReadonlySet<FedosDeletionRequestDeviceStatus> = new Set([
  "applied-local-history",
  "applied-local-history-and-index",
  "partially-applied",
  "rejected",
  "expired",
  "failed",
  "revoked-device",
]);
const PENDING_STATUSES: ReadonlySet<FedosDeletionRequestDeviceStatus> = new Set([
  "draft",
  "pending-delivery",
  "relay-acknowledged",
  "recipient-received",
  "awaiting-recipient-decision",
  "approved",
]);

/**
 * One Device acknowledgement never proves account-wide deletion — this
 * function's own closed return type has no `"deleted-everywhere"`/
 * `"account-deleted"` value at all, structurally, regardless of input.
 */
export function fedosDeletionRequestAggregateAccountStatus(rows: readonly FedosDeletionRequestPerDeviceRow[]): FedosDeletionRequestAccountAggregateStatus {
  if (rows.length === 0) return "no-device-requests";

  const knownRows = rows.filter((r) => r.status !== "unknown-device" && r.status !== "offline-or-unobserved");
  if (knownRows.length === 0) return "no-known-device-confirmed";

  const anyConfirmedTerminal = knownRows.some((r) => TERMINAL_STATUSES.has(r.status));
  if (!anyConfirmedTerminal) {
    const anyPending = knownRows.some((r) => PENDING_STATUSES.has(r.status));
    return anyPending ? "some-devices-pending" : "no-known-device-confirmed";
  }

  const allTerminal = knownRows.every((r) => TERMINAL_STATUSES.has(r.status));
  const distinctTerminalOutcomes = new Set(knownRows.filter((r) => TERMINAL_STATUSES.has(r.status)).map((r) => r.status));
  const anyApplied = knownRows.some((r) => APPLIED_STATUSES.has(r.status));

  if (allTerminal) {
    return distinctTerminalOutcomes.size > 1 ? "mixed-outcomes" : "all-known-devices-responded";
  }
  if (anyApplied) return "some-devices-applied";
  return "mixed-outcomes";
}
