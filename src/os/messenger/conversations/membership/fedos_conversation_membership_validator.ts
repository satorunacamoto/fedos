/**
 * Secure Runtime Alpha 826 ("Membership Codec") prerequisite — Stage 6
 * of the Alpha 821–850 Durable Conversation Membership & Capability
 * Persistence Arc.
 *
 * `FedosConversationMembership` (Alpha 766) had no dedicated validator —
 * the in-memory Membership Authority (Alpha 771, frozen, unchanged)
 * constructs it directly, an internal-construction path that never
 * needed a fail-closed candidate-validation boundary. The Membership
 * Codec (`./persistence/fedos_conversation_membership_codec.ts`) DOES
 * need one — reconstructing a membership from untrusted, possibly
 * corrupt, on-disk bytes is exactly the "validator is the sole
 * constructor for a candidate of external origin" case
 * `validateFedosConversationRecord` (Alpha 748) already established.
 * This file fills that one prerequisite gap; it does NOT touch or
 * redirect `InMemoryFedosConversationMembershipAuthority`'s own existing
 * construction path (still frozen, still direct object construction).
 *
 * HARD GUARDRAILS:
 *   - Fails closed: `null` for anything malformed, never throws.
 *   - Exact field set; unknown/extra field rejected.
 *   - `role`/`state` checked against the existing closed vocabularies
 *     (`FEDOS_CONVERSATION_ROLES`/`FEDOS_CONVERSATION_MEMBERSHIP_STATES`,
 *     unmodified).
 *   - `participant` validated via the existing
 *     `validateFedosConversationParticipantReference` (Alpha 763,
 *     unmodified) — no second participant-validation path invented.
 *   - `endedAt === null` iff `state === "active"` — the same invariant
 *     `FedosConversationMembership`'s own header already documents,
 *     enforced here for the first time as a real check.
 *   - Deep-copies and `Object.freeze`s the result.
 */

import { FEDOS_CONVERSATION_ROLES, type FedosConversationRole } from "../../../../conversation/membership/fedos_conversation_role.js";
import { FEDOS_CONVERSATION_MEMBERSHIP_STATES, type FedosConversationMembershipState } from "../../../../conversation/membership/fedos_conversation_membership_state.js";
import { validateFedosConversationParticipantReference } from "../../../../conversation/membership/fedos_conversation_participant_reference_validator.js";
import type { FedosConversationMembership } from "../../../../conversation/membership/fedos_conversation_membership.js";
import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationMembershipId } from "../../../../conversation/membership/fedos_conversation_membership_id.js";
import { FEDOS_BOARD_POST_MIN_CREATED_AT, FEDOS_BOARD_POST_MAX_CREATED_AT } from "../../../../board/fedos_board_post_validator.js";

export interface FedosConversationMembershipInput {
  readonly id: string;
  readonly conversationId: string;
  readonly participant: unknown;
  readonly role: string;
  readonly state: string;
  readonly joinedAt: number;
  readonly endedAt: number | null;
}

const EXPECTED_KEYS: readonly string[] = ["conversationId", "endedAt", "id", "joinedAt", "participant", "role", "state"]
  .slice()
  .sort();

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= FEDOS_BOARD_POST_MIN_CREATED_AT &&
    value <= FEDOS_BOARD_POST_MAX_CREATED_AT
  );
}

/** Validates and constructs a `FedosConversationMembership`. See this file's own header for the full check list. */
export function validateFedosConversationMembership(candidate: unknown): FedosConversationMembership | null {
  if (candidate === null || typeof candidate !== "object") return null;

  const keys = Object.keys(candidate).sort();
  if (keys.length !== EXPECTED_KEYS.length || !keys.every((key, index) => key === EXPECTED_KEYS[index])) {
    return null;
  }

  const value = candidate as Record<string, unknown>;

  if (!isNonEmptyString(value.id)) return null;
  const id = value.id as FedosConversationMembershipId;

  if (!isNonEmptyString(value.conversationId)) return null;
  const conversationId = value.conversationId as FedosConversationId;

  const participant = validateFedosConversationParticipantReference(value.participant);
  if (participant === null) return null;

  if (typeof value.role !== "string" || !FEDOS_CONVERSATION_ROLES.includes(value.role as FedosConversationRole)) {
    return null;
  }
  const role = value.role as FedosConversationRole;

  if (typeof value.state !== "string" || !FEDOS_CONVERSATION_MEMBERSHIP_STATES.includes(value.state as FedosConversationMembershipState)) {
    return null;
  }
  const state = value.state as FedosConversationMembershipState;

  if (!isValidTimestamp(value.joinedAt)) return null;
  const joinedAt = value.joinedAt as number;

  let endedAt: number | null;
  if (value.endedAt === null) {
    endedAt = null;
  } else if (isValidTimestamp(value.endedAt)) {
    endedAt = value.endedAt as number;
  } else {
    return null;
  }

  // `endedAt === null` iff `state === "active"` (FedosConversationMembership's own documented invariant).
  if (state === "active" && endedAt !== null) return null;
  if (state !== "active" && endedAt === null) return null;
  if (endedAt !== null && endedAt < joinedAt) return null;

  return Object.freeze({
    id,
    conversationId,
    participant,
    role,
    state,
    joinedAt,
    endedAt,
  });
}
