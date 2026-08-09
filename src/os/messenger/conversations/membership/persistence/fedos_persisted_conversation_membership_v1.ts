/**
 * Secure Runtime Alpha 825 ("Persisted Membership Record V1") — Stage 5
 * of the Alpha 821–850 Durable Conversation Membership & Capability
 * Persistence Arc.
 *
 * The STABLE WIRE SHAPE — mirrors `FedosPersistedConversationRecordV1`'s
 * own discipline (Alpha 750): every field a plain `string`/`number`, no
 * branded type, no nested object. `participant` (a nested object on the
 * runtime `FedosConversationMembership`) is FLATTENED into three scalar
 * fields (`participantAuthority`/`participantPublicIdentifier`/
 * `participantIdentityId`) — no existing persisted wire shape in this
 * codebase embeds a nested object; this file does not introduce the
 * first one.
 *
 * `id` is the SAME deterministic `FedosConversationMembershipId`
 * (Alpha 767, unmodified) — every persistence backend keys off it
 * directly, exactly like `FedosPersistedConversationRecordV1.id` does
 * for Conversation persistence.
 *
 * HARD GUARDRAILS:
 *   - `FedosPersistedConversationMembershipV1` is the ONLY export.
 *   - `schemaVersion` is the literal numeric type `1`.
 *   - No secret, no display name/avatar.
 *   - This file defines a TYPE ONLY — no function, no class.
 */

export interface FedosPersistedConversationMembershipV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly conversationId: string;
  readonly participantAuthority: string;
  readonly participantPublicIdentifier: string;
  readonly participantIdentityId: string | null;
  readonly role: string;
  readonly state: string;
  readonly joinedAt: number;
  readonly endedAt: number | null;
}
