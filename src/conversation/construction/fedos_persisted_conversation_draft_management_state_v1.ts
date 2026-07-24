/**
 * Secure Runtime Alpha 1002 ("Draft Management State Record") — Phase C of the
 * Alpha 991–1050 Conversation Invitation Transport & Draft Management Arc.
 *
 * The STABLE WIRE SHAPE for one immutable draft-management transition fact.
 * The underlying draft record (`FedosPersistedConversationDraftRecordV1`, Alpha
 * 894) is IMMUTABLE and its port forbids delete/rewrite, so delete/restore
 * CANNOT mutate it in place. Instead — mirroring the way the Membership
 * persistence port carries `active → revoked|left` as separate append-only
 * facts (Alpha 827) and the construction-coordination log carries phase
 * progression (Alpha 913) — this Arc records each managed-state transition as
 * its OWN immutable fact in a SEPARATE log, and reconstructs the current
 * managed state on read.
 *
 * Unlike the monotonic coordination phases, delete/restore can legitimately
 * ALTERNATE (`draft → tombstoned → draft → ...`), so a rank-based resolution
 * does not fit. Each fact instead carries a monotonically increasing
 * `revision` (0-based), keyed by `(conversationId, revision)`, and the CURRENT
 * managed state is the highest-`revision` fact's `managedState` (default
 * `"draft"` when no fact exists — the base state every constructed draft starts
 * in). This preserves append-only, insert-only, no-rewrite discipline: a new
 * transition is a NEW record at a NEW revision, never an overwrite.
 *
 * `actor*` records who performed the transition (for audit + so the manager's
 * authorization decision is a durable fact, not an ephemeral one). NO bearer
 * secret, key, or payload is carried.
 *
 * HARD GUARDRAILS:
 *   - `schemaVersion` is the literal numeric type `1`.
 *   - Every field a plain `string`/`number`/`null`.
 *   - This file defines TYPES + deterministic helpers — no class.
 */

export interface FedosPersistedConversationDraftManagementStateV1 {
  readonly schemaVersion: 1;
  readonly conversationId: string;
  /** 0-based, strictly increasing per conversation. The highest revision is the current state. */
  readonly revision: number;
  /** `"draft"` or `"tombstoned"` — a subset of `FedosConversationLifecycleState` (Alpha 893). */
  readonly managedState: string;
  readonly actorAuthority: string;
  readonly actorPublicIdentifier: string;
  readonly actorIdentityId: string | null;
  /** Unix seconds. */
  readonly updatedAt: number;
}

/** Internal storage key — `(conversationId, revision)`, never `conversationId` alone (an alternating lifecycle needs per-revision keying). */
export function fedosConversationDraftManagementStateRecordKey(conversationId: string, revision: number): string {
  return `${conversationId}::${revision}`;
}

/** Structural equality over every field — decides `"already-present"` vs `"conflict"` for a duplicate `(conversationId, revision)` key. */
export function fedosPersistedConversationDraftManagementStatesAreEqual(
  a: FedosPersistedConversationDraftManagementStateV1,
  b: FedosPersistedConversationDraftManagementStateV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.conversationId === b.conversationId &&
    a.revision === b.revision &&
    a.managedState === b.managedState &&
    a.actorAuthority === b.actorAuthority &&
    a.actorPublicIdentifier === b.actorPublicIdentifier &&
    a.actorIdentityId === b.actorIdentityId &&
    a.updatedAt === b.updatedAt
  );
}

/**
 * Resolves the CURRENT (highest-revision) management fact for one conversation
 * out of every `(conversationId, revision)`-keyed fact a backend holds for it.
 * `null` when no fact exists (the caller then treats the managed state as the
 * base `"draft"`). Two DIFFERENT facts sharing the same revision are genuine
 * corruption and are rejected at the backend replay layer, not here.
 */
export function resolveCurrentDraftManagementState(
  factsForConversation: readonly FedosPersistedConversationDraftManagementStateV1[],
): FedosPersistedConversationDraftManagementStateV1 | null {
  if (factsForConversation.length === 0) return null;
  let current = factsForConversation[0]!;
  for (const fact of factsForConversation) {
    if (fact.revision > current.revision) current = fact;
  }
  return current;
}
