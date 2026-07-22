/**
 * Secure Runtime Alpha 6121–6200 — Phase B/L/M: pure screen-model
 * builders. No Shell call, no persistence, no cryptography — every
 * function here only reshapes an already-safe DTO from the domain layer
 * into exactly what one screen needs, resolving centralized warning text
 * (never an inline string). Mirrors `fedos_deletion_request_screen_model.ts`'s
 * own "pure builder functions producing plain frozen DTOs" discipline.
 */
import type { FedosIdentityTransitionPeerStatusView } from "../../../conversation/identity_transition/peer_integration/fedos_identity_transition_peer_runtime.js";
import type { FedosIdentityTransitionSafeViewV1 } from "../../../conversation/identity_transition/peer_integration/fedos_identity_transition_safe_view.js";
import { fedosIdentityTransitionWarningText, type FedosIdentityTransitionWarningCode } from "../../../conversation/identity_transition/peer_integration/fedos_identity_transition_warning_codes.js";
import type { FedosIdentityTransitionSessionImpactRowV1 } from "../../../conversation/identity_transition/peer_integration/fedos_identity_transition_ratchet_impact_view.js";

export const FEDOS_IDENTITY_TRANSITION_INBOX_MAX_ITEMS = 200;

export interface FedosIdentityTransitionInboxItem {
  readonly transitionId: string;
  readonly revision: number;
  readonly evidenceOutcome: FedosIdentityTransitionPeerStatusView["evidenceOutcome"];
  readonly acceptanceState: FedosIdentityTransitionPeerStatusView["acceptanceState"];
  readonly superseded: boolean;
}

/** Deterministic ordering: highest revision first, then transitionId — stable across a restart since it never depends on insertion order alone. */
export function fedosIdentityTransitionSortInboxItems(items: readonly FedosIdentityTransitionInboxItem[]): readonly FedosIdentityTransitionInboxItem[] {
  return [...items].sort((a, b) => b.revision - a.revision || a.transitionId.localeCompare(b.transitionId));
}

export function fedosIdentityTransitionTruncateInboxItems(items: readonly FedosIdentityTransitionInboxItem[], limit: number): readonly FedosIdentityTransitionInboxItem[] {
  const boundedLimit = Math.max(0, Math.min(limit, FEDOS_IDENTITY_TRANSITION_INBOX_MAX_ITEMS));
  return items.slice(0, boundedLimit);
}

export function fedosIdentityTransitionBuildInboxItem(view: FedosIdentityTransitionPeerStatusView): FedosIdentityTransitionInboxItem {
  return Object.freeze({
    transitionId: view.transitionId,
    revision: view.revision,
    evidenceOutcome: view.evidenceOutcome,
    acceptanceState: view.acceptanceState,
    superseded: view.superseded,
  });
}

export interface FedosIdentityTransitionDetailContent extends FedosIdentityTransitionSafeViewV1 {
  readonly warningText: readonly string[];
}

/** The ONE place warning CODES are resolved to warning TEXT for display — every screen that shows a transition's warnings goes through this, never an inline string (Phase Q's own requirement). */
export function fedosIdentityTransitionBuildDetailContent(view: FedosIdentityTransitionSafeViewV1): FedosIdentityTransitionDetailContent {
  return Object.freeze({ ...view, warningText: view.warnings.map((code: FedosIdentityTransitionWarningCode) => fedosIdentityTransitionWarningText(code)) });
}

export interface FedosIdentityTransitionRatchetResetConfirmationContent {
  readonly transitionId: string;
  readonly acceptanceState: FedosIdentityTransitionPeerStatusView["acceptanceState"];
  readonly canAuthorize: boolean;
  readonly sessions: readonly FedosIdentityTransitionSessionImpactRowV1[];
  readonly warningText: readonly string[];
}

const RESET_CONFIRMATION_WARNING_CODES: readonly FedosIdentityTransitionWarningCode[] = [
  "existing-ratchet-keys-will-not-move",
  "new-secure-session-required",
  "historical-messages-remain-attributed-to-old-identity",
  "other-devices-may-decide-independently",
];

/** Phase H's own required pre-authorization disclosure content — always shown, regardless of `canAuthorize`, so a user sees exactly what a reset means even before it becomes available. */
export function fedosIdentityTransitionBuildRatchetResetConfirmationContent(
  transitionId: string,
  acceptanceState: FedosIdentityTransitionPeerStatusView["acceptanceState"],
  sessions: readonly FedosIdentityTransitionSessionImpactRowV1[],
): FedosIdentityTransitionRatchetResetConfirmationContent {
  return Object.freeze({
    transitionId,
    acceptanceState,
    canAuthorize: acceptanceState === "accepted",
    sessions,
    warningText: RESET_CONFIRMATION_WARNING_CODES.map((code) => fedosIdentityTransitionWarningText(code)),
  });
}
