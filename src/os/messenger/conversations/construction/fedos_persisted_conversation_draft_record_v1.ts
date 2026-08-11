/**
 * Secure Runtime Alpha 894 ("Conversation Record Compatibility") — the
 * STABLE WIRE SHAPE for a `FedosConversationDraftRecord` (Alpha 894),
 * mirroring `FedosPersistedConversationRecordV1`'s own discipline (Alpha
 * 750): a plain, serializable shape — every field a `string`/`number`,
 * `participant` flattened to three scalar fields exactly as
 * `FedosPersistedConversationMembershipV1` already does (Alpha 825), no
 * branded type, no nested object, no secret.
 *
 * A brand-new wire shape with NO prior persisted generation — so
 * `lifecycleState` is carried inline safely (Alpha 894), and the public
 * `FedosPersistedConversationRecordV1` is untouched.
 *
 * HARD GUARDRAILS:
 *   - `FedosPersistedConversationDraftRecordV1` is the ONLY export.
 *   - `schemaVersion` is the literal numeric type `1`.
 *   - This file defines a TYPE ONLY — no function, no class.
 */

export interface FedosPersistedConversationDraftRecordV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly mode: string;
  readonly lifecycleState: string;
  readonly policyReference: string;
  readonly creatorAuthority: string;
  readonly creatorPublicIdentifier: string;
  readonly creatorIdentityId: string | null;
  readonly createdAt: number;
}
