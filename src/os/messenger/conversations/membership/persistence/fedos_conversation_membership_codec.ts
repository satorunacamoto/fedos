/**
 * Secure Runtime Alpha 826 ("Membership Codec") — Stage 6 of the Alpha
 * 821–850 Durable Conversation Membership & Capability Persistence Arc.
 *
 * The ONLY two functions permitted to convert between the runtime
 * `FedosConversationMembership` (Alpha 766) and the persisted wire
 * shape `FedosPersistedConversationMembershipV1`
 * (`./fedos_persisted_conversation_membership_v1.ts`) — mirrors
 * `serializeFedosConversationRecord`/`deserializeFedosConversationRecord`'s
 * own exact discipline (Alpha 750).
 *
 * HARD GUARDRAILS:
 *   - `deserializeFedosConversationMembership` fails closed: `null` for
 *     anything malformed, never throws.
 *   - `schemaVersion` checked EXACTLY against `1` — no silent migration.
 *   - Unknown top-level fields are REJECTED.
 *   - `deserializeFedosConversationMembership` reuses
 *     `validateFedosConversationMembership` (this Arc's own new Alpha
 *     826 prerequisite) rather than re-implementing any check.
 *   - Round-trip equality: `deserializeFedosConversationMembership(serializeFedosConversationMembership(m))`
 *     equals `m` field-for-field, verified by
 *     `test/secure_runtime_alpha_825_826_membership_codec.test.ts`.
 */

import { validateFedosConversationMembership, type FedosConversationMembershipInput } from "../../../../../conversation/membership/fedos_conversation_membership_validator.js";
import type { FedosConversationMembership } from "../../../../../conversation/membership/fedos_conversation_membership.js";
import type { FedosPersistedConversationMembershipV1 } from "../../../../../conversation/membership/persistence/fedos_persisted_conversation_membership_v1.js";

/** Deep-copies `membership` into the persisted V1 wire shape, flattening `participant`. */
export function serializeFedosConversationMembership(membership: FedosConversationMembership): FedosPersistedConversationMembershipV1 {
  return {
    schemaVersion: 1,
    id: membership.id,
    conversationId: membership.conversationId,
    participantAuthority: membership.participant.authority,
    participantPublicIdentifier: membership.participant.publicIdentifier,
    participantIdentityId: membership.participant.identityId,
    role: membership.role,
    state: membership.state,
    joinedAt: membership.joinedAt,
    endedAt: membership.endedAt,
  };
}

const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "id",
  "conversationId",
  "participantAuthority",
  "participantPublicIdentifier",
  "participantIdentityId",
  "role",
  "state",
  "joinedAt",
  "endedAt",
]);

interface RawTopLevelFields {
  readonly schemaVersion: unknown;
  readonly id: unknown;
  readonly conversationId: unknown;
  readonly participantAuthority: unknown;
  readonly participantPublicIdentifier: unknown;
  readonly participantIdentityId: unknown;
  readonly role: unknown;
  readonly state: unknown;
  readonly joinedAt: unknown;
  readonly endedAt: unknown;
}

/** Fails closed to `null` for any malformed, unrecognized-schema, or corrupt input. */
export function deserializeFedosConversationMembership(record: unknown): FedosConversationMembership | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => TOP_LEVEL_KEYS.has(key))) return null;

  const {
    schemaVersion,
    id,
    conversationId,
    participantAuthority,
    participantPublicIdentifier,
    participantIdentityId,
    role,
    state,
    joinedAt,
    endedAt,
  } = record as RawTopLevelFields;

  if (schemaVersion !== 1) return null;
  if (typeof id !== "string") return null;
  if (typeof conversationId !== "string") return null;
  if (typeof participantAuthority !== "string") return null;
  if (typeof participantPublicIdentifier !== "string") return null;
  if (participantIdentityId !== null && typeof participantIdentityId !== "string") return null;
  if (typeof role !== "string") return null;
  if (typeof state !== "string") return null;
  if (typeof joinedAt !== "number") return null;
  if (endedAt !== null && typeof endedAt !== "number") return null;

  const input: FedosConversationMembershipInput = {
    id,
    conversationId,
    participant: {
      authority: participantAuthority,
      publicIdentifier: participantPublicIdentifier,
      identityId: participantIdentityId,
    },
    role,
    state,
    joinedAt,
    endedAt,
  };

  return validateFedosConversationMembership(input);
}
