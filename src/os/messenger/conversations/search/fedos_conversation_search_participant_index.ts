/**
 * Secure Runtime Alpha 2501–2580 ("Conversation Search Runtime") —
 * Participant Index.
 *
 * Buckets indexed Envelopes (and the conversations they belong to) by
 * the `FedosConversationParticipantReference` who sent them — REUSES
 * Conversation Runtime's own `FedosConversationMembershipAuthority`
 * (`../membership/fedos_conversation_membership_authority.ts`, Alpha
 * 770; the same authority `FedosConversationRuntimeDependencies`,
 * `../runtime/fedos_conversation_runtime.ts`, already bundles) to
 * resolve an Envelope's `senderMembershipId` back to a participant,
 * never inventing a second membership-resolution path.
 *
 * `FedosConversationMembershipAuthority` exposes no direct
 * "get-membership-by-id" method (only `findMembership(conversationId,
 * participant)`, the reverse direction) — resolution goes through
 * `listMemberships(conversationId)` and matches `.id`, mirroring
 * `FedosConversationRuntime.listMemberships()`'s own read-facade use of
 * that exact method
 * (`../runtime/fedos_conversation_runtime.ts`). That scan is memoized
 * per `senderMembershipId` (a membership id is itself deterministic —
 * `toFedosConversationMembershipId`, Alpha 767 — so caching by id alone
 * is safe even across conversations) to stay correct under this Arc's
 * own **large dataset** verification without re-scanning a
 * conversation's membership list once per Envelope.
 *
 * An Envelope whose `senderMembershipId` cannot be resolved (a
 * membership record that no longer exists, or a caller-supplied
 * document referencing one the injected authority does not know about)
 * is bucketed under the reserved `"unknown"` key rather than thrown —
 * fails closed, matches this codebase's own "never throw on
 * caller-suppliable but unverifiable input" discipline
 * (`fedos_conversation_archive_restore.ts`'s own "never throws" header,
 * Alpha 1541–1610).
 *
 * HARD GUARDRAILS:
 *   - No module-level mutable state — every instance owns its own Maps.
 *   - Never mutates `membershipAuthority`; read-only consumer.
 *   - `removeDocument()` fully reverses `indexDocument()`.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationEnvelopeId } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationMembershipId } from "../membership/fedos_conversation_membership_id.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import type { FedosConversationSearchEnvelopeDocument } from "./fedos_conversation_search_document.js";

export interface FedosConversationSearchParticipantIndexDependencies {
  readonly membershipAuthority: FedosConversationMembershipAuthority;
}

/** Reserved bucket key for an Envelope whose sender membership cannot be resolved — see this file's own header. */
const UNKNOWN_PARTICIPANT_KEY = "unknown";

function participantKey(participant: FedosConversationParticipantReference): string {
  return `${participant.authority}::${participant.publicIdentifier}`;
}

export class FedosConversationSearchParticipantIndex {
  readonly #membershipAuthority: FedosConversationMembershipAuthority;
  readonly #resolvedByMembershipId = new Map<FedosConversationMembershipId, FedosConversationParticipantReference | null>();
  readonly #envelopesByParticipantKey = new Map<string, Set<FedosConversationEnvelopeId>>();
  readonly #conversationsByParticipantKey = new Map<string, Set<FedosConversationId>>();
  readonly #keyByEnvelope = new Map<FedosConversationEnvelopeId, string>();

  constructor(deps: FedosConversationSearchParticipantIndexDependencies) {
    this.#membershipAuthority = deps.membershipAuthority;
  }

  #resolveParticipant(
    conversationId: FedosConversationId,
    senderMembershipId: FedosConversationMembershipId,
  ): FedosConversationParticipantReference | null {
    const cached = this.#resolvedByMembershipId.get(senderMembershipId);
    if (cached !== undefined) return cached;
    const memberships = this.#membershipAuthority.listMemberships(conversationId);
    const found = memberships.find((membership) => membership.id === senderMembershipId) ?? null;
    const resolved = found === null ? null : found.participant;
    this.#resolvedByMembershipId.set(senderMembershipId, resolved);
    return resolved;
  }

  indexDocument(doc: FedosConversationSearchEnvelopeDocument): void {
    const participant = this.#resolveParticipant(doc.conversationId, doc.senderMembershipId);
    const key = participant === null ? UNKNOWN_PARTICIPANT_KEY : participantKey(participant);

    let envelopes = this.#envelopesByParticipantKey.get(key);
    if (envelopes === undefined) {
      envelopes = new Set<FedosConversationEnvelopeId>();
      this.#envelopesByParticipantKey.set(key, envelopes);
    }
    envelopes.add(doc.envelopeId);

    let conversations = this.#conversationsByParticipantKey.get(key);
    if (conversations === undefined) {
      conversations = new Set<FedosConversationId>();
      this.#conversationsByParticipantKey.set(key, conversations);
    }
    conversations.add(doc.conversationId);

    this.#keyByEnvelope.set(doc.envelopeId, key);
  }

  removeDocument(envelopeId: FedosConversationEnvelopeId): void {
    const key = this.#keyByEnvelope.get(envelopeId);
    if (key === undefined) return;
    const envelopes = this.#envelopesByParticipantKey.get(key);
    if (envelopes !== undefined) {
      envelopes.delete(envelopeId);
      if (envelopes.size === 0) this.#envelopesByParticipantKey.delete(key);
    }
    this.#keyByEnvelope.delete(envelopeId);
  }

  /** Every currently-indexed Envelope sent by `participant`, deterministically sorted; empty for an unresolvable/never-seen participant. */
  envelopesByParticipant(participant: FedosConversationParticipantReference): readonly FedosConversationEnvelopeId[] {
    const envelopes = this.#envelopesByParticipantKey.get(participantKey(participant));
    if (envelopes === undefined) return [];
    return [...envelopes].sort();
  }

  /** Every Conversation `participant` has sent at least one currently-indexed Envelope in, deterministically sorted. */
  conversationsByParticipant(participant: FedosConversationParticipantReference): readonly FedosConversationId[] {
    const conversations = this.#conversationsByParticipantKey.get(participantKey(participant));
    if (conversations === undefined) return [];
    return [...conversations].sort();
  }
}
