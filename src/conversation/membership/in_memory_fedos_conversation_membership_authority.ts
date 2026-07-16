/**
 * Secure Runtime Alpha 771 ("In-Memory Membership Authority") — Stage 11
 * of the Alpha 761–790 Canonical Conversation Membership & Capability
 * Foundation Arc.
 *
 * A REAL implementation (not a stub — the prior review's own
 * `10_membership_boundary.md` §"no fake allow-all membership" warning
 * applies to any authority claiming to enforce something it does not;
 * this one enforces the Alpha 768 transition contract for real, on real
 * state, with no bypass). Mirrors
 * `InMemoryFedosConversationPersistence`'s own private-field `Map`-
 * backed convention (`../persistence/in_memory_fedos_conversation_persistence.ts`,
 * Alpha 751).
 *
 * HARD GUARDRAILS:
 *   - No module-level mutable state — every instance owns its own `Map`,
 *     independent instances never share state, no cross-Conversation
 *     contamination.
 *   - `admit()` is idempotent for an identical `(conversationId,
 *     participant, role)` triple — `"already-present"`, not a second
 *     record.
 *   - Every returned `FedosConversationMembership` is deep-frozen; a
 *     caller mutating a returned object never affects this authority's
 *     own internal state.
 *   - `listMemberships()` returns a NEW array every call.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationMembership } from "./fedos_conversation_membership.js";
import { toFedosConversationMembershipId, type FedosConversationMembershipId } from "./fedos_conversation_membership_id.js";
import type { FedosConversationMembershipAuthority } from "./fedos_conversation_membership_authority.js";
import type {
  FedosConversationMembershipAdmissionPreview,
  FedosConversationMembershipMutationResult,
} from "./fedos_conversation_membership_result.js";
import type { FedosConversationParticipantReference } from "./fedos_conversation_participant_reference.js";
import type { FedosConversationRole } from "./fedos_conversation_role.js";
import { isFedosConversationMembershipTransitionAllowed } from "./fedos_conversation_membership_transition.js";

function freezeMembership(membership: FedosConversationMembership): FedosConversationMembership {
  return Object.freeze({
    ...membership,
    participant: Object.freeze({ ...membership.participant }),
  });
}

export class InMemoryFedosConversationMembershipAuthority implements FedosConversationMembershipAuthority {
  readonly #memberships = new Map<FedosConversationMembershipId, FedosConversationMembership>();

  previewAdmission(
    conversationId: FedosConversationId,
    participant: FedosConversationParticipantReference,
  ): FedosConversationMembershipAdmissionPreview {
    const id = toFedosConversationMembershipId(conversationId, participant);
    const existing = this.#memberships.get(id) ?? null;
    if (existing === null) return { outcome: "would-admit" };
    if (existing.state === "active") return { outcome: "already-active" };
    return { outcome: "blocked", reason: "invalid-transition" };
  }

  admit(
    conversationId: FedosConversationId,
    participant: FedosConversationParticipantReference,
    role: FedosConversationRole,
    now: number,
  ): FedosConversationMembershipMutationResult {
    const id = toFedosConversationMembershipId(conversationId, participant);
    const existing = this.#memberships.get(id) ?? null;

    if (existing !== null && existing.state === "active") {
      if (existing.role !== role) return { outcome: "conflict" };
      return { outcome: "already-present", membership: freezeMembership(existing) };
    }
    if (!isFedosConversationMembershipTransitionAllowed(existing?.state ?? null, "admit")) {
      return { outcome: "invalid-transition" };
    }

    const membership: FedosConversationMembership = {
      id,
      conversationId,
      participant,
      role,
      state: "active",
      joinedAt: now,
      endedAt: null,
    };
    this.#memberships.set(id, membership);
    return { outcome: "admitted", membership: freezeMembership(membership) };
  }

  findMembership(
    conversationId: FedosConversationId,
    participant: FedosConversationParticipantReference,
  ): FedosConversationMembership | null {
    const id = toFedosConversationMembershipId(conversationId, participant);
    const existing = this.#memberships.get(id) ?? null;
    return existing === null ? null : freezeMembership(existing);
  }

  listMemberships(conversationId: FedosConversationId): readonly FedosConversationMembership[] {
    return [...this.#memberships.values()]
      .filter((membership) => membership.conversationId === conversationId)
      .map(freezeMembership);
  }

  revoke(
    conversationId: FedosConversationId,
    participant: FedosConversationParticipantReference,
    now: number,
  ): FedosConversationMembershipMutationResult {
    return this.#endMembership(conversationId, participant, "revoked", now);
  }

  leave(
    conversationId: FedosConversationId,
    participant: FedosConversationParticipantReference,
    now: number,
  ): FedosConversationMembershipMutationResult {
    return this.#endMembership(conversationId, participant, "left", now);
  }

  #endMembership(
    conversationId: FedosConversationId,
    participant: FedosConversationParticipantReference,
    endState: "revoked" | "left",
    now: number,
  ): FedosConversationMembershipMutationResult {
    const id = toFedosConversationMembershipId(conversationId, participant);
    const existing = this.#memberships.get(id) ?? null;
    if (existing === null) return { outcome: "not-found" };

    const transition = endState === "revoked" ? "revoke" : "leave";
    if (!isFedosConversationMembershipTransitionAllowed(existing.state, transition)) {
      return { outcome: "invalid-transition" };
    }

    const updated: FedosConversationMembership = { ...existing, state: endState, endedAt: now };
    this.#memberships.set(id, updated);
    return { outcome: endState === "revoked" ? "revoked" : "left", membership: freezeMembership(updated) };
  }
}
