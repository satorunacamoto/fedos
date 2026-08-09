/**
 * Secure Runtime Alpha 1001 ("Managed Draft State") — Phase C of the Alpha
 * 991–1050 Conversation Invitation Transport & Draft Management Arc.
 *
 * The managed lifecycle a draft may occupy from the Draft Manager's
 * perspective — a strict, additive SUBSET of the already-frozen
 * `FedosConversationLifecycleState` vocabulary (Alpha 893): `"draft"` and
 * `"tombstoned"` only. Alpha 893 named `"tombstoned"` precisely so a future
 * reviewed operation could transition into it; this Arc is that operation.
 * `"active"`/`"closed"` are deliberately NOT part of managed draft state — this
 * Arc performs no activation and no close (those remain future-Arc concerns).
 *
 * "Delete" a draft = transition managed state to `"tombstoned"` (a soft,
 * append-only, reversible state change — NEVER a physical removal, honoring the
 * "fail closed, no silent data loss, append-only" discipline of Alpha 918/919).
 * "Restore" = transition back to `"draft"`.
 *
 * A `FedosConversationDraftSummary` is an immutable, non-secret read shape for
 * listing/search: base draft metadata plus the current managed state. A
 * `FedosConversationDraftSearchQuery` is a closed set of optional filters — no
 * free-form predicate function, no arbitrary metadata bag.
 */

import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../../../../conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosPrivateConversationMode } from "../../../../conversation/construction/fedos_private_conversation_id.js";
import type { FedosPrivateConversationPolicyReference } from "../../../../conversation/construction/fedos_conversation_draft_record.js";

/** The managed lifecycle a Draft Manager recognizes — a subset of `FedosConversationLifecycleState` (Alpha 893). */
export type FedosConversationManagedDraftState = "draft" | "tombstoned";

export const FEDOS_CONVERSATION_MANAGED_DRAFT_STATES: readonly FedosConversationManagedDraftState[] = ["draft", "tombstoned"];

export function isFedosConversationManagedDraftState(value: unknown): value is FedosConversationManagedDraftState {
  return value === "draft" || value === "tombstoned";
}

/** Immutable, non-secret summary of one draft for listing/search — base metadata plus its current managed state. */
export interface FedosConversationDraftSummary {
  readonly id: FedosConversationId;
  readonly mode: FedosPrivateConversationMode;
  readonly policyReference: FedosPrivateConversationPolicyReference;
  readonly creator: FedosConversationParticipantReference;
  readonly createdAt: number;
  readonly managedState: FedosConversationManagedDraftState;
}

/**
 * A closed set of optional filters for `searchDrafts()`. Every field is
 * optional; an omitted field imposes no constraint. When multiple fields are
 * present they are ANDed. No free-form predicate, no arbitrary metadata.
 */
export interface FedosConversationDraftSearchQuery {
  readonly mode?: FedosPrivateConversationMode;
  readonly managedState?: FedosConversationManagedDraftState;
  /** Match drafts whose creator is exactly this participant (authority + publicIdentifier). */
  readonly creator?: FedosConversationParticipantReference;
  /** Inclusive lower bound on `createdAt` (Unix seconds). */
  readonly createdAtFrom?: number;
  /** Inclusive upper bound on `createdAt` (Unix seconds). */
  readonly createdAtTo?: number;
}
