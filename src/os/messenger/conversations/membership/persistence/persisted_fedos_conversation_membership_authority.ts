/**
 * Secure Runtime Alpha 830 ("Persisted Membership Authority") — Stage 10
 * of the Alpha 821–850 Durable Conversation Membership & Capability
 * Persistence Arc.
 *
 * A NEW implementation of `FedosConversationMembershipAuthority` (Alpha
 * 770, frozen, unmodified interface) backed by a
 * `FedosConversationMembershipPersistence` port instead of an in-memory
 * `Map` — an ADAPTER alongside `InMemoryFedosConversationMembershipAuthority`
 * (also frozen, unmodified), never a replacement of it. Reuses the SAME
 * transition contract (`isFedosConversationMembershipTransitionAllowed`,
 * Alpha 768, unmodified) and the SAME id derivation
 * (`toFedosConversationMembershipId`, Alpha 767, unmodified) — zero
 * redesign of already-complete Phase A logic, only re-plumbed onto a
 * durable backend.
 *
 * HARD GUARDRAILS:
 *   - Public interface identical to `FedosConversationMembershipAuthority`
 *     — a caller cannot tell which implementation it holds.
 *   - `previewAdmission()` reads through the injected persistence port
 *     before every mutating call — restart-stable by construction (a
 *     fresh instance over the SAME backend sees identical state).
 *   - No mutation on `"conflict"`/`"invalid-transition"`/`"not-found"`.
 *   - Every returned `FedosConversationMembership` is deep-frozen.
 */

import type { FedosConversationId } from "../../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationMembership } from "../../../../../conversation/membership/fedos_conversation_membership.js";
import { toFedosConversationMembershipId } from "../../../../../conversation/membership/fedos_conversation_membership_id.js";
import type { FedosConversationMembershipAuthority } from "../../../../../conversation/membership/fedos_conversation_membership_authority.js";
import type {
  FedosConversationMembershipAdmissionPreview,
  FedosConversationMembershipMutationResult,
} from "../../../../../conversation/membership/fedos_conversation_membership_result.js";
import type { FedosConversationParticipantReference } from "../../../../../conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationRole } from "../../../../../conversation/membership/fedos_conversation_role.js";
import { isFedosConversationMembershipTransitionAllowed } from "../../../../../conversation/membership/fedos_conversation_membership_transition.js";
import { deserializeFedosConversationMembership, serializeFedosConversationMembership } from "../../../../../conversation/membership/persistence/fedos_conversation_membership_codec.js";
import type { FedosConversationMembershipPersistence } from "../../../../../conversation/membership/persistence/fedos_conversation_membership_persistence.js";

function freezeMembership(membership: FedosConversationMembership): FedosConversationMembership {
  return Object.freeze({ ...membership, participant: Object.freeze({ ...membership.participant }) });
}

/** Reads the current, durable state for one membership id, decoding through the codec. Throws (never silently loses data) if a stored record fails to decode -- see Alpha 831/832. */
function readCurrent(
  persistence: FedosConversationMembershipPersistence,
  id: string,
): FedosConversationMembership | null {
  const stored = persistence.getMembership(id);
  if (stored === null) return null;
  const decoded = deserializeFedosConversationMembership(stored);
  if (decoded === null) {
    throw new Error(
      `PersistedFedosConversationMembershipAuthority: invariant violated -- stored record for membership id "${id}" failed to decode.`,
    );
  }
  return decoded;
}

export class PersistedFedosConversationMembershipAuthority implements FedosConversationMembershipAuthority {
  readonly #persistence: FedosConversationMembershipPersistence;

  constructor(persistence: FedosConversationMembershipPersistence) {
    this.#persistence = persistence;
  }

  previewAdmission(
    conversationId: FedosConversationId,
    participant: FedosConversationParticipantReference,
  ): FedosConversationMembershipAdmissionPreview {
    const id = toFedosConversationMembershipId(conversationId, participant);
    const existing = readCurrent(this.#persistence, id);
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
    const existing = readCurrent(this.#persistence, id);

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
    const writeResult = this.#persistence.putMembership(serializeFedosConversationMembership(membership));
    switch (writeResult) {
      case "inserted":
        return { outcome: "admitted", membership: freezeMembership(membership) };
      case "already-present":
        return { outcome: "admitted", membership: freezeMembership(membership) };
      case "conflict":
        return { outcome: "conflict" };
      case "failed":
        return { outcome: "unavailable" };
    }
  }

  findMembership(
    conversationId: FedosConversationId,
    participant: FedosConversationParticipantReference,
  ): FedosConversationMembership | null {
    const id = toFedosConversationMembershipId(conversationId, participant);
    const existing = readCurrent(this.#persistence, id);
    return existing === null ? null : freezeMembership(existing);
  }

  listMemberships(conversationId: FedosConversationId): readonly FedosConversationMembership[] {
    return this.#persistence.listConversationMemberships(conversationId).map((stored) => {
      const decoded = deserializeFedosConversationMembership(stored);
      if (decoded === null) {
        throw new Error(
          `PersistedFedosConversationMembershipAuthority: invariant violated -- stored record for membership id "${stored.id}" failed to decode.`,
        );
      }
      return freezeMembership(decoded);
    });
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
    const existing = readCurrent(this.#persistence, id);
    if (existing === null) return { outcome: "not-found" };

    const transition = endState === "revoked" ? "revoke" : "leave";
    if (!isFedosConversationMembershipTransitionAllowed(existing.state, transition)) {
      return { outcome: "invalid-transition" };
    }

    const updated: FedosConversationMembership = { ...existing, state: endState, endedAt: now };
    const writeResult = this.#persistence.putMembership(serializeFedosConversationMembership(updated));
    const outcome = endState === "revoked" ? "revoked" : "left";
    switch (writeResult) {
      case "inserted":
        return { outcome, membership: freezeMembership(updated) };
      case "already-present":
        return { outcome, membership: freezeMembership(updated) };
      case "conflict":
        return { outcome: "conflict" };
      case "failed":
        return { outcome: "unavailable" };
    }
  }
}
