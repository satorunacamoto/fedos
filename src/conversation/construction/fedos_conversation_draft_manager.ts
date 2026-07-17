/**
 * Secure Runtime Alpha 1006 ("Draft Manager") — Phase C of the Alpha 991–1050
 * Conversation Invitation Transport & Draft Management Arc.
 *
 * The application-layer manager for the private-draft catalogue: listing,
 * search, soft-delete (tombstone), and restore. Composes the frozen, immutable
 * `FedosConversationDraftPersistence` (Alpha 894, the base record) with the
 * NEW, additive `FedosConversationDraftManagementPersistence` (Alpha 1003, the
 * append-only managed-state facts) — it NEVER mutates or deletes a base draft
 * record (that port forbids it and this Arc honors the "no silent data loss,
 * append-only" discipline of Alpha 918/919).
 *
 * "Delete" = append a `"tombstoned"` managed-state fact; the base record stays
 * durable and fully recoverable. "Restore" = append a `"draft"` fact,
 * transitioning the managed state back. Listing/search join each base record
 * with its current managed state.
 *
 * Authorization is INJECTED (never hard-wired to Membership) — an adapter
 * boundary matching the frozen Capability issuer authority's own injected
 * checks (Alpha 780). The assembly (Alpha 1011) supplies a real check: the
 * actor is the draft's creator, or an active owner/moderator member.
 *
 * Fails closed everywhere: an absent draft is `"not-found"`; an
 * unreadable/corrupt base record is `"unavailable"`, never silently skipped in
 * a mutation; a corrupt managed-state value throws (matching the append-only
 * corruption discipline); every operation returns a closed outcome token.
 */

import type { FedosBoardRuntimeClock } from "../../board/runtime/fedos_board_runtime_clock.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import { deserializeFedosConversationDraftRecord } from "./fedos_conversation_draft_record_codec.js";
import type { FedosConversationDraftRecord } from "./fedos_conversation_draft_record.js";
import type { FedosConversationDraftPersistence } from "./fedos_conversation_draft_persistence.js";
import type { FedosConversationDraftManagementPersistence } from "./fedos_conversation_draft_management_persistence.js";
import {
  isFedosConversationManagedDraftState,
  type FedosConversationDraftSearchQuery,
  type FedosConversationDraftSummary,
  type FedosConversationManagedDraftState,
} from "./fedos_conversation_managed_draft_state.js";
import type {
  FedosConversationDraftDeleteResult,
  FedosConversationDraftRestoreResult,
} from "./fedos_conversation_draft_management_result.js";
import type { FedosPersistedConversationDraftManagementStateV1 } from "./fedos_persisted_conversation_draft_management_state_v1.js";

/**
 * Injected — decides whether `actor` may manage (delete/restore) `draft`. Kept
 * INJECTED, never hard-wired to any one authority. See this file's own header.
 */
export type FedosConversationDraftManagementAuthorizationCheck = (
  draft: FedosConversationDraftRecord,
  actor: FedosConversationParticipantReference,
) => boolean;

export interface FedosConversationDraftManagerDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly managementPersistence: FedosConversationDraftManagementPersistence;
  readonly authorizationCheck: FedosConversationDraftManagementAuthorizationCheck;
  readonly clock: FedosBoardRuntimeClock;
}

function participantsEqual(a: FedosConversationParticipantReference, b: FedosConversationParticipantReference): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier;
}

export class FedosConversationDraftManager {
  readonly #deps: FedosConversationDraftManagerDependencies;

  constructor(deps: FedosConversationDraftManagerDependencies) {
    this.#deps = deps;
  }

  /** Alpha 1006 — every draft (all managed states), as immutable summaries. A base record that fails to deserialize is skipped (fail closed on read). */
  listDrafts(): readonly FedosConversationDraftSummary[] {
    const summaries: FedosConversationDraftSummary[] = [];
    for (const persisted of this.#deps.draftPersistence.listDrafts()) {
      const record = deserializeFedosConversationDraftRecord(persisted);
      if (record === null) continue;
      summaries.push(this.#summary(record));
    }
    return summaries;
  }

  /** Alpha 1006 — drafts matching a closed set of optional filters (ANDed). An empty query returns every draft. */
  searchDrafts(query: FedosConversationDraftSearchQuery): readonly FedosConversationDraftSummary[] {
    return this.listDrafts().filter((summary) => matchesQuery(summary, query));
  }

  /** Alpha 1006 — soft-delete (tombstone) a draft. The base record is never removed. Idempotent when already tombstoned. */
  deleteDraft(id: string, actor: FedosConversationParticipantReference): FedosConversationDraftDeleteResult {
    const record = this.#readDraft(id);
    if (record === "not-found") return { outcome: "not-found" };
    if (record === "unreadable") return { outcome: "unavailable" };
    if (!this.#deps.authorizationCheck(record, actor)) return { outcome: "unauthorized" };

    const current = this.#deps.managementPersistence.getCurrentManagementState(id);
    if (this.#stateOf(current) === "tombstoned") {
      return { outcome: "already-deleted", summary: this.#summary(record, "tombstoned") };
    }

    const write = this.#appendFact(id, current, "tombstoned", actor);
    if (write === "conflict") return { outcome: "conflict" };
    if (write === "failed") return { outcome: "unavailable" };
    return { outcome: "deleted", summary: this.#summary(record, "tombstoned") };
  }

  /** Alpha 1006 — restore a tombstoned draft back to `"draft"`. `"not-deleted"` when it was not tombstoned. */
  restoreDraft(id: string, actor: FedosConversationParticipantReference): FedosConversationDraftRestoreResult {
    const record = this.#readDraft(id);
    if (record === "not-found") return { outcome: "not-found" };
    if (record === "unreadable") return { outcome: "unavailable" };
    if (!this.#deps.authorizationCheck(record, actor)) return { outcome: "unauthorized" };

    const current = this.#deps.managementPersistence.getCurrentManagementState(id);
    if (this.#stateOf(current) !== "tombstoned") {
      return { outcome: "not-deleted", summary: this.#summary(record, "draft") };
    }

    const write = this.#appendFact(id, current, "draft", actor);
    if (write === "conflict") return { outcome: "conflict" };
    if (write === "failed") return { outcome: "unavailable" };
    return { outcome: "restored", summary: this.#summary(record, "draft") };
  }

  #readDraft(id: string): FedosConversationDraftRecord | "not-found" | "unreadable" {
    const persisted = this.#deps.draftPersistence.getDraft(id as FedosConversationId);
    if (persisted === null) return "not-found";
    const record = deserializeFedosConversationDraftRecord(persisted);
    return record === null ? "unreadable" : record;
  }

  #appendFact(
    id: string,
    current: FedosPersistedConversationDraftManagementStateV1 | null,
    managedState: FedosConversationManagedDraftState,
    actor: FedosConversationParticipantReference,
  ): "inserted" | "already-present" | "conflict" | "failed" {
    const nextRevision = (current?.revision ?? -1) + 1;
    return this.#deps.managementPersistence.putManagementFact({
      schemaVersion: 1,
      conversationId: id,
      revision: nextRevision,
      managedState,
      actorAuthority: actor.authority,
      actorPublicIdentifier: actor.publicIdentifier,
      actorIdentityId: actor.identityId,
      updatedAt: this.#deps.clock(),
    });
  }

  /** Current managed state for a draft — base `"draft"` when no fact exists; throws on a corrupt stored value (fail closed). */
  #stateOf(current: FedosPersistedConversationDraftManagementStateV1 | null): FedosConversationManagedDraftState {
    if (current === null) return "draft";
    if (!isFedosConversationManagedDraftState(current.managedState)) {
      throw new Error(
        `FedosConversationDraftManager: corrupt managed-state value "${String(current.managedState)}" for conversation "${current.conversationId}".`,
      );
    }
    return current.managedState;
  }

  #summary(record: FedosConversationDraftRecord, managedStateOverride?: FedosConversationManagedDraftState): FedosConversationDraftSummary {
    const managedState =
      managedStateOverride ?? this.#stateOf(this.#deps.managementPersistence.getCurrentManagementState(record.id));
    return Object.freeze({
      id: record.id,
      mode: record.mode,
      policyReference: record.policyReference,
      creator: record.creator,
      createdAt: record.createdAt,
      managedState,
    });
  }
}

function matchesQuery(summary: FedosConversationDraftSummary, query: FedosConversationDraftSearchQuery): boolean {
  if (query.mode !== undefined && summary.mode !== query.mode) return false;
  if (query.managedState !== undefined && summary.managedState !== query.managedState) return false;
  if (query.creator !== undefined && !participantsEqual(summary.creator, query.creator)) return false;
  if (query.createdAtFrom !== undefined && summary.createdAt < query.createdAtFrom) return false;
  if (query.createdAtTo !== undefined && summary.createdAt > query.createdAtTo) return false;
  return true;
}
