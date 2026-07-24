/**
 * Secure Runtime Alpha 996 ("Invitation Revocation Record") — Phase B of the
 * Alpha 991–1050 Conversation Invitation Transport & Draft Management Arc.
 *
 * The STABLE WIRE SHAPE for one terminal invitation-revocation fact, mirroring
 * `FedosPersistedConversationMembershipV1`'s own flattening discipline (Alpha
 * 825) and `FedosPersistedConversationDraftRecordV1`'s own plain-scalar shape
 * (Alpha 894): every field a `string`/`number`/`null`, no nested object, no
 * branded type, no secret.
 *
 * A revocation is a ONE-WAY, at-most-one-per-capability fact (per this Arc's
 * reconciliation, Finding 2: no un-revoke), so — unlike Membership/Capability
 * — a single record per `capabilityId` is sufficient; this record needs no
 * `(id, state)` event-keying. `capabilityId` refers to the PUBLIC capability
 * id being revoked; NO bearer secret, key, or token is carried anywhere.
 *
 * HARD GUARDRAILS:
 *   - `FedosPersistedConversationInvitationRevocationV1` is the ONLY export
 *     that is a type; the file also exports one key helper and one equality
 *     helper, matching the sibling persisted-record files.
 *   - `schemaVersion` is the literal numeric type `1`.
 *   - No bearer secret, no key material, no arbitrary payload.
 */

export interface FedosPersistedConversationInvitationRevocationV1 {
  readonly schemaVersion: 1;
  /** The PUBLIC id of the revoked capability/invitation — never a bearer secret. */
  readonly capabilityId: string;
  readonly conversationId: string;
  readonly revokedByAuthority: string;
  readonly revokedByPublicIdentifier: string;
  readonly revokedByIdentityId: string | null;
  /** Unix seconds, matching every other timestamp in this codebase. */
  readonly revokedAt: number;
}

/** Internal storage key — `capabilityId` alone; a capability is revoked at most once. */
export function fedosConversationInvitationRevocationRecordKey(capabilityId: string): string {
  return `revocation::${capabilityId}`;
}

/** Field-by-field structural equality — decides `"already-present"` vs `"conflict"` at the registry level (Alpha 749 discipline). */
export function fedosPersistedConversationInvitationRevocationsAreEqual(
  a: FedosPersistedConversationInvitationRevocationV1,
  b: FedosPersistedConversationInvitationRevocationV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.capabilityId === b.capabilityId &&
    a.conversationId === b.conversationId &&
    a.revokedByAuthority === b.revokedByAuthority &&
    a.revokedByPublicIdentifier === b.revokedByPublicIdentifier &&
    a.revokedByIdentityId === b.revokedByIdentityId &&
    a.revokedAt === b.revokedAt
  );
}
