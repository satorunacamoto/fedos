/**
 * Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-Device
 * Aggregation and User Consent UI Arc) — Phases C/D/E/F: pure screen-content
 * builders. No Shell call, no ViewModel reference, no mutation. Every shape
 * here is plain, JSON-serializable data.
 */
import type { FedosDeletionRequestInboxSummaryV1 } from "../../../conversation/deletion_request/fedos_deletion_request_inbox_summary.js";
import type { FedosDeletionRecipientDecisionState } from "../../../conversation/deletion_request/fedos_deletion_recipient_decision_state.js";
import type { FedosDeletionRequestScope } from "../../../conversation/deletion_request/fedos_deletion_request_scope.js";
import type { FedosDeletionRecipientPolicyDecision } from "../../../conversation/deletion_request/fedos_deletion_recipient_policy.js";
import type { FedosDeletionRequestPerDeviceRow, FedosDeletionRequestAccountAggregateStatus } from "./fedos_deletion_request_device_status.js";

// ---------------------------------------------------------------------
// Phase F — centralized, closed warning vocabulary.
// ---------------------------------------------------------------------

export type FedosDeletionRequestWarningCode =
  | "recipient-may-reject"
  | "other-devices-may-retain"
  | "archive-backup-may-remain"
  | "relay-ciphertext-may-remain"
  | "external-copies-unverifiable"
  | "not-physical-erasure-proof";

const WARNING_TEXT: Readonly<Record<FedosDeletionRequestWarningCode, string>> = {
  "recipient-may-reject": "This asks the recipient to remove a local copy. The recipient may reject the request.",
  "other-devices-may-retain": "Other Devices belonging to the recipient may retain a copy.",
  "archive-backup-may-remain": "Archives and backups may still contain this message even if the request is applied.",
  "relay-ciphertext-may-remain": "Encrypted copies on Relays are not deleted by this request.",
  "external-copies-unverifiable": "Screenshots, exports, notifications, or copies made outside FedOS cannot be verified or affected.",
  "not-physical-erasure-proof": "An acknowledgement is a Device's own signed claim, not proof of physical erasure.",
};

export function fedosDeletionRequestWarningText(code: FedosDeletionRequestWarningCode): string {
  return WARNING_TEXT[code];
}

/** Every request/consent screen shows the SAME complete warning set — never a subset chosen ad hoc per screen. */
export const FEDOS_DELETION_REQUEST_STANDARD_WARNINGS: readonly FedosDeletionRequestWarningCode[] = [
  "recipient-may-reject",
  "other-devices-may-retain",
  "archive-backup-may-remain",
  "relay-ciphertext-may-remain",
  "external-copies-unverifiable",
  "not-physical-erasure-proof",
];

// ---------------------------------------------------------------------
// Phase C — recipient consent detail content.
// ---------------------------------------------------------------------

export interface FedosDeletionRequestConsentDetailContent {
  readonly requestId: string;
  readonly requesterAccountRef: string;
  readonly requesterDeviceRef: string | null;
  readonly conversationId: string;
  readonly requestedScope: FedosDeletionRequestScope;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly reasonCode: string | null;
  readonly decisionState: FedosDeletionRecipientDecisionState;
  readonly isTerminal: boolean;
  readonly isExecutable: boolean;
  readonly policyDecision: FedosDeletionRecipientPolicyDecision["decision"] | null;
  readonly localScopeOptions: readonly FedosDeletionRequestScope[];
  readonly warnings: readonly FedosDeletionRequestWarningCode[];
}

const TERMINAL_DECISION_STATES: ReadonlySet<FedosDeletionRecipientDecisionState> = new Set([
  "unauthorized",
  "expired",
  "unsupported",
  "policy-rejected",
  "locally-applied",
  "partially-applied",
  "failed",
]);

/**
 * `isExecutable` is `true` ONLY for `"policy-pending"` (an `"always-review"`
 * item genuinely awaiting a human decision) — every other state (including
 * every terminal one) is `false`: no request may execute solely because a
 * detail screen opened it (mission's own explicit requirement), and a
 * terminal item has nothing left to execute.
 */
export function fedosDeletionRequestBuildConsentDetail(
  summary: FedosDeletionRequestInboxSummaryV1,
  decisionState: FedosDeletionRecipientDecisionState,
  policyDecision: FedosDeletionRecipientPolicyDecision | null,
): FedosDeletionRequestConsentDetailContent {
  const localScopeOptions: readonly FedosDeletionRequestScope[] =
    summary.scope === "local-history-and-index" ? ["local-history", "local-history-and-index"] : ["local-history"];
  return Object.freeze({
    requestId: summary.requestId,
    requesterAccountRef: summary.requesterAccountRef,
    requesterDeviceRef: summary.requesterDeviceRef,
    conversationId: summary.conversationId,
    requestedScope: summary.scope,
    issuedAt: summary.issuedAt,
    expiresAt: summary.expiresAt,
    reasonCode: summary.reasonCode,
    decisionState,
    isTerminal: TERMINAL_DECISION_STATES.has(decisionState),
    isExecutable: decisionState === "policy-pending",
    policyDecision: policyDecision?.decision ?? null,
    localScopeOptions,
    warnings: FEDOS_DELETION_REQUEST_STANDARD_WARNINGS,
  });
}

// ---------------------------------------------------------------------
// Phase D — recipient Inbox item / list.
// ---------------------------------------------------------------------

export type FedosDeletionRequestInboxDisplayStatus =
  | "pending-review"
  | "policy-rejected"
  | "authorization-failed"
  | "expired"
  | "approved-executing"
  | "applied"
  | "partial"
  | "failed";

export function fedosDeletionRequestInboxDisplayStatus(decisionState: FedosDeletionRecipientDecisionState): FedosDeletionRequestInboxDisplayStatus {
  switch (decisionState) {
    case "received":
    case "validated":
    case "policy-pending":
      return "pending-review";
    case "policy-rejected":
      return "policy-rejected";
    case "unauthorized":
      return "authorization-failed";
    case "expired":
      return "expired";
    case "unsupported":
      return "authorization-failed";
    case "local-plan-ready":
      return "approved-executing";
    case "locally-applied":
      return "applied";
    case "partially-applied":
      return "partial";
    case "failed":
      return "failed";
  }
}

export interface FedosDeletionRequestInboxItem {
  readonly requestId: string;
  readonly requesterAccountRef: string;
  readonly conversationId: string;
  readonly issuedAt: number;
  readonly displayStatus: FedosDeletionRequestInboxDisplayStatus;
  readonly isExecutable: boolean;
  readonly isDismissable: boolean;
}

const DISMISSABLE_STATUSES: ReadonlySet<FedosDeletionRequestInboxDisplayStatus> = new Set([
  "policy-rejected",
  "authorization-failed",
  "expired",
  "applied",
  "partial",
  "failed",
]);

export function fedosDeletionRequestBuildInboxItem(
  summary: FedosDeletionRequestInboxSummaryV1,
  decisionState: FedosDeletionRecipientDecisionState | null,
): FedosDeletionRequestInboxItem {
  const state = decisionState ?? "received";
  const displayStatus = fedosDeletionRequestInboxDisplayStatus(state);
  return Object.freeze({
    requestId: summary.requestId,
    requesterAccountRef: summary.requesterAccountRef,
    conversationId: summary.conversationId,
    issuedAt: summary.issuedAt,
    displayStatus,
    isExecutable: displayStatus === "pending-review" && state === "policy-pending",
    isDismissable: DISMISSABLE_STATUSES.has(displayStatus),
  });
}

/** Deterministic ordering: newest-issued-first, ties broken by `requestId` (Phase D's own "deterministic ordering" requirement). Duplicate requestId collapses to one item BEFORE this sort runs (the caller's own `Map`-keyed source already guarantees that). */
export function fedosDeletionRequestSortInboxItems(items: readonly FedosDeletionRequestInboxItem[]): readonly FedosDeletionRequestInboxItem[] {
  return [...items].sort((a, b) => (b.issuedAt !== a.issuedAt ? b.issuedAt - a.issuedAt : a.requestId.localeCompare(b.requestId)));
}

export const FEDOS_DELETION_REQUEST_INBOX_MAX_ITEMS = 200;

export function fedosDeletionRequestTruncateInboxItems(
  items: readonly FedosDeletionRequestInboxItem[],
  limit = FEDOS_DELETION_REQUEST_INBOX_MAX_ITEMS,
): { readonly items: readonly FedosDeletionRequestInboxItem[]; readonly truncated: boolean } {
  if (items.length <= limit) return { items, truncated: false };
  return { items: items.slice(0, limit), truncated: true };
}

// ---------------------------------------------------------------------
// Phase E — sender-side per-target status view.
// ---------------------------------------------------------------------

export interface FedosDeletionRequestSentStatusView {
  readonly conversationId: string;
  readonly targetEnvelopeId: string;
  readonly perDevice: readonly FedosDeletionRequestPerDeviceRow[];
  readonly aggregate: FedosDeletionRequestAccountAggregateStatus;
  readonly warnings: readonly FedosDeletionRequestWarningCode[];
}

export function fedosDeletionRequestBuildSentStatusView(
  conversationId: string,
  targetEnvelopeId: string,
  perDevice: readonly FedosDeletionRequestPerDeviceRow[],
  aggregate: FedosDeletionRequestAccountAggregateStatus,
): FedosDeletionRequestSentStatusView {
  return Object.freeze({ conversationId, targetEnvelopeId, perDevice, aggregate, warnings: FEDOS_DELETION_REQUEST_STANDARD_WARNINGS });
}
