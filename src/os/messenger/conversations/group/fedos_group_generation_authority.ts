/**
 * Secure Runtime Alpha 1324/1358/1361 ("Group Generation Identity" /
 * "Generation Transition Coordinator" / "Concurrent Membership Change")
 * — Phase A/D of the Alpha 1321–1390 Private Group Pairwise Fanout
 * Foundation Arc.
 *
 * `createNextGeneration()` snapshots the group's OWN, existing, frozen
 * `FedosConversationMembershipAuthority` state (Alpha 761–790,
 * unmodified) into a new, immutable `FedosGroupGenerationRecord`. It
 * never mutates an old generation and never rotates any key — a
 * generation is a MEMBERSHIP snapshot, not a cryptographic epoch (Alpha
 * 1358's own "no shared-key rotation" instruction). Calling it again
 * with no actual roster change is a safe no-op (`"unchanged"`), never a
 * duplicate generation. Single-writer only (Alpha 1361) — this
 * authority performs no locking of its own; a caller invoking it
 * concurrently from two different processes against the SAME append-only
 * log may race, and a losing write surfaces as `"conflict"`, never a
 * silently-merged result.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationDraftPersistence } from "../construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import { toFedosConversationMembershipId } from "../membership/fedos_conversation_membership_id.js";
import type { FedosConversationIdentityResolver } from "../encryption/identity/fedos_conversation_identity_resolver.js";
import {
  toFedosGroupGenerationId,
  validateFedosGroupGenerationRecord,
  type FedosGroupGenerationPersistence,
  type FedosGroupGenerationRecord,
} from "./fedos_group_generation.js";
import type { FedosGroupParticipantLimitPolicy } from "./fedos_group_participant_limit.js";
import {
  toFedosGroupDirectPathId,
  type FedosGroupDirectPathPersistence,
} from "./fedos_group_direct_path.js";

export type FedosGroupCreateNextGenerationResult =
  | { readonly outcome: "created"; readonly generation: FedosGroupGenerationRecord }
  | { readonly outcome: "unchanged"; readonly generation: FedosGroupGenerationRecord }
  | { readonly outcome: "conversation-not-found" }
  | { readonly outcome: "invalid-mode" }
  | { readonly outcome: "insufficient-members" }
  | { readonly outcome: "limit-exceeded" }
  | { readonly outcome: "persistence-failed" }
  | { readonly outcome: "conflict" };

export interface FedosGroupGenerationAuthorityDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly generationPersistence: FedosGroupGenerationPersistence;
  readonly pathPersistence: FedosGroupDirectPathPersistence;
  readonly participantLimitPolicy: FedosGroupParticipantLimitPolicy;
  readonly identityResolver: FedosConversationIdentityResolver;
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export class FedosGroupGenerationAuthority {
  readonly #deps: FedosGroupGenerationAuthorityDependencies;

  constructor(deps: FedosGroupGenerationAuthorityDependencies) {
    this.#deps = deps;
  }

  createNextGeneration(groupConversationId: FedosConversationId, now: number): FedosGroupCreateNextGenerationResult {
    const draft = this.#deps.draftPersistence.getDraft(groupConversationId);
    if (draft === null) return { outcome: "conversation-not-found" };
    if (draft.mode !== "private-group") return { outcome: "invalid-mode" };

    const activeMembers = this.#deps.membershipAuthority
      .listMemberships(groupConversationId)
      .filter((m) => m.state === "active");
    if (activeMembers.length < 2) return { outcome: "insufficient-members" };
    if (activeMembers.length > this.#deps.participantLimitPolicy.maxActiveMembers()) return { outcome: "limit-exceeded" };

    const activeMemberMembershipIds = [...activeMembers.map((m) => m.id as string)].sort();
    const current = this.#deps.generationPersistence.currentGenerationForGroup(groupConversationId);
    if (current !== null && arraysEqual(current.activeMemberMembershipIds, activeMemberMembershipIds)) {
      return { outcome: "unchanged", generation: current };
    }

    const generationNumber = (current?.generationNumber ?? -1) + 1;
    const generationId = toFedosGroupGenerationId(groupConversationId, generationNumber);
    const record = validateFedosGroupGenerationRecord({
      groupConversationId,
      generationId,
      generationNumber,
      activeMemberMembershipIds,
      createdAt: now,
      previousGenerationId: current?.generationId ?? null,
    });
    if (record === null) return { outcome: "persistence-failed" };

    const write = this.#deps.generationPersistence.putGeneration(record);
    if (write === "failed") return { outcome: "persistence-failed" };
    if (write === "conflict") return { outcome: "conflict" };

    if (current !== null) this.#supersedeRemovedMemberPaths(groupConversationId, current, record, now);

    return { outcome: "created", generation: record };
  }

  /** Alpha 1359 — an old, ready path for a member excluded from the new generation is marked `"superseded"`, never deleted. */
  #supersedeRemovedMemberPaths(
    groupConversationId: FedosConversationId,
    oldGeneration: FedosGroupGenerationRecord,
    newGeneration: FedosGroupGenerationRecord,
    now: number,
  ): void {
    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") return;
    const localMembershipId = toFedosConversationMembershipId(groupConversationId, identity.creator);
    const removedIds = oldGeneration.activeMemberMembershipIds.filter(
      (id) => id !== localMembershipId && !newGeneration.activeMemberMembershipIds.includes(id),
    );
    for (const removedId of removedIds) {
      const oldPathId = toFedosGroupDirectPathId(groupConversationId, oldGeneration.generationId, localMembershipId, removedId);
      const existing = this.#deps.pathPersistence.getPath(oldPathId);
      if (existing === null || existing.state !== "ready") continue;
      this.#deps.pathPersistence.putPathFact({ ...existing, state: "superseded", updatedAt: now });
    }
  }
}
