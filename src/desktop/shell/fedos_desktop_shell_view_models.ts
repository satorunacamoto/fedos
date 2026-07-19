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
 * codebase. No transport-native id is exposed.
 *
 * Secure Runtime Alpha 3081-3160 — `MessageView.plaintext.state` can now be
 * genuinely `"available"`: `FedosDesktopApplicationShell.readMessage()` is
 * wired to a real Conversation Content Accessor
 * (`../content_accessor/fedos_desktop_conversation_content_accessor.ts`)
 * that reaches real Envelope/Payload persistence through the accepted
 * Direct/Group messaging authorities. `listMessages()` itself still never
 * decrypts (Alpha 1139's own unchanged rule) — its own `plaintext` is
 * always `"unavailable"` with an honest reason pointing at `readMessage()`.
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

/**
 * Secure Runtime Alpha 3081-3160 — widened from the fixed `"unavailable"`
 * literal this Arc's own predecessor (Alpha 2841-2920) used, now that a
 * real Conversation Content Accessor reaches real local write/retention
 * state. `"stored-locally"` means this Envelope was durably written by
 * THIS device — it says nothing about remote delivery (Phase F's own
 * "never claim remote delivery from a local write" rule; there is no
 * `"delivered"`/`"sent-remotely"` value here for exactly that reason).
 * `"unavailable"` remains valid or the base genuinely cannot reach local
 * write-state.
 */
export type FedosMessageLocalDeliveryStateView = "stored-locally" | "unavailable";

/**
 * Secure Runtime Alpha 3081-3160 — widened from the fixed `"unavailable"`
 * literal, now reflecting `FedosPayloadRetentionAuthority`'s own real,
 * already-established three-state vocabulary (Alpha 796, UNCHANGED) plus
 * the pre-existing `"unavailable"` value for when retention state itself
 * cannot be determined (e.g. a malformed payload id).
 */
export type FedosMessageRetentionStateView = "active" | "tombstoned" | "payload-removed" | "unavailable";

export interface FedosMessageView {
  readonly messageId: string;
  readonly conversationId: FedosConversationId;
  readonly senderMembershipId: string;
  readonly createdAt: number;
  readonly replyToMessageId: string | null;
  readonly plaintext: FedosMessagePlaintextView;
  readonly localDeliveryState: FedosMessageLocalDeliveryStateView;
  readonly retentionState: FedosMessageRetentionStateView;
}

/**
 * Secure Runtime Alpha 3081-3160 — the result of a just-performed
 * `sendMessage()`/`reply()` call. Deliberately NOT a `FedosMessageView` —
 * see `FedosContentAccessorSendResult`'s own header
 * (`../content_accessor/fedos_desktop_conversation_content_accessor_result.ts`)
 * for why. `fanout` is `"not-applicable"` for a Direct send (no fan-out
 * concept exists); `"complete"`/`"partial"` for a Group send.
 */
export interface FedosMessageSendResultView {
  readonly messageId: string;
  readonly conversationId: FedosConversationId;
  readonly createdAt: number;
  readonly localWrite: "stored";
  readonly fanout: "not-applicable" | "complete" | "partial";
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
