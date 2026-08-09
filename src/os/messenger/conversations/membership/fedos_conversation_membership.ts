/**
 * Secure Runtime Alpha 766 ("Membership Record V1") — Stage 6 of the
 * Alpha 761–790 Canonical Conversation Membership & Capability
 * Foundation Arc.
 *
 * The minimum IMMUTABLE shape one Conversation Membership carries in
 * V1. Mirrors `FedosConversationRecord`'s own "every field readonly, no
 * speculative field, only the validator constructs it" discipline
 * (`../fedos_conversation_record.ts`, Alpha 745).
 *
 * Explicitly EXCLUDED (this Arc's own Absolute Prohibitions, and the
 * prior review's own §07/§13 "pseudonym/profile never used for
 * authorization" finding):
 *   - invitation secret / bearer material — Capability-domain, never
 *     Membership-domain (`../capability/`).
 *   - encryption key / key epoch reference — this Arc implements no
 *     encryption of any kind.
 *   - message history — Membership records participation, never content.
 *   - display pseudonym — a Membership is keyed by `participant`, never
 *     by whatever pseudonym is currently displayed for that member.
 *   - device list, delivery status — owned by other, unrelated domains.
 *   - arbitrary metadata bag — matches `FedosConversationRecord`'s own
 *     "speculative fields disallowed" rule.
 *
 * HARD GUARDRAILS:
 *   - Every field `readonly`; no mutation method or setter.
 *   - Only `validateFedosConversationMembership`
 *     (`./fedos_conversation_membership_validator.ts`) constructs one.
 *   - `joinedAt`/`endedAt` are Unix SECONDS, matching
 *     `FedosConversationRecord.createdAt`'s own convention.
 */

import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationMembershipId } from "../../../../conversation/membership/fedos_conversation_membership_id.js";
import type { FedosConversationParticipantReference } from "../../../../conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationRole } from "../../../../conversation/membership/fedos_conversation_role.js";
import type { FedosConversationMembershipState } from "../../../../conversation/membership/fedos_conversation_membership_state.js";

export interface FedosConversationMembership {
  readonly id: FedosConversationMembershipId;
  readonly conversationId: FedosConversationId;
  readonly participant: FedosConversationParticipantReference;
  readonly role: FedosConversationRole;
  readonly state: FedosConversationMembershipState;
  /** Unix seconds — when this membership first became `"active"`. */
  readonly joinedAt: number;
  /** Unix seconds `revoked`/`left` took effect, or `null` while still `"active"`. */
  readonly endedAt: number | null;
}
