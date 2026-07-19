/**
 * Secure Runtime Alpha 2841–2920 ("Desktop Local Application Shell and
 * Conversation Management Boundary Arc") — Phase C.
 *
 * Closed, immutable, UI-facing read shapes. Every field is either already
 * public by construction (a `FedosConversationParticipantReference`'s
 * `authority`/`publicIdentifier`/`identityId` — never a secret, per that
 * type's own header) or derived from an existing read facade
 * (`FedosConversationRuntime`'s `findConversation`/`readinessForConversation`/
 * `listMemberships`/`constructionStatus`/`issuedCapabilityDescriptors`).
 *
 * No read receipt, online presence, remote deletion, or recipient delivery
 * status is invented here — none of those facts exist anywhere in this
 * codebase. No transport-native id is exposed. `MessageView` is defined for
 * API-shape completeness (Phase C requires it) but this Arc can only ever
 * produce one with `plaintext.state === "unavailable"` — see
 * `docs/secure_runtime_alpha_2841_2920_execution_spec.md` Phase A/A6 for the
 * exact reason (no accessor on `FedosRunningDesktopRuntime` reaches Envelope
 * persistence).
 */

import type { FedosConversationId } from "../../conversation/fedos_conversation_id.js";
import type { FedosPrivateConversationMode } from "../../conversation/construction/fedos_private_conversation_id.js";
import type { FedosConversationLifecycleState } from "../../conversation/construction/fedos_conversation_lifecycle_state.js";
import type {
  FedosConversationOverallReadinessOutcome,
  FedosConversationReadiness,
} from "../../conversation/readiness/fedos_conversation_readiness.js";
import type { FedosConversationMembership } from "../../conversation/membership/fedos_conversation_membership.js";
import type { FedosConversationParticipantReference } from "../../conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationConstructionCoordinationPhase } from "../../conversation/construction/coordination/fedos_persisted_conversation_construction_coordination_v1.js";
import type { FedosConversationCapabilityDescriptor } from "../../conversation/capability/fedos_conversation_capability_descriptor.js";

/**
 * `activationStatus` is the live `readinessForConversation().overall`
 * reading — the only "activation status" primitive this base exposes
 * (see execution spec Phase A/A2/H). It is read-only: no
 * `activate()`/`reactivate()` method exists anywhere on this shell, because
 * no mutating primitive exists on `FedosConversationRuntime` to call.
 */
export interface FedosConversationSummaryView {
  readonly conversationId: FedosConversationId;
  readonly mode: FedosPrivateConversationMode;
  readonly lifecycleState: FedosConversationLifecycleState;
  readonly activationStatus: FedosConversationOverallReadinessOutcome;
  readonly participantCount: number;
  readonly createdAt: number;
  readonly constructionStatus: FedosConversationConstructionCoordinationPhase | null;
}

export interface FedosConversationDetailView extends FedosConversationSummaryView {
  readonly creator: FedosConversationParticipantReference;
  readonly readiness: FedosConversationReadiness;
  readonly memberships: readonly FedosConversationMembership[];
}

export type FedosMessagePlaintextView =
  | { readonly state: "available"; readonly text: string }
  | { readonly state: "unavailable"; readonly reason: string };

export interface FedosMessageView {
  readonly messageId: string;
  readonly conversationId: FedosConversationId;
  readonly senderMembershipId: string;
  readonly createdAt: number;
  readonly replyToMessageId: string | null;
  readonly plaintext: FedosMessagePlaintextView;
  readonly localDeliveryState: "unavailable";
  readonly retentionState: "unavailable";
}

export interface FedosIssuedInvitationView {
  readonly descriptor: FedosConversationCapabilityDescriptor;
}

export interface FedosDeviceStatusView {
  readonly state: "unavailable";
  readonly reason: string;
}

export interface FedosConversationListFilter {
  readonly mode?: FedosPrivateConversationMode;
  readonly lifecycleState?: FedosConversationLifecycleState;
}
