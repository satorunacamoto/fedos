/**
 * Secure Runtime Alpha 833 ("Persisted Capability Descriptor V1") /
 * Alpha 838 ("Capability State Event Model") — Stages 1/6 of Phase C of
 * the Alpha 821–850 Durable Conversation Membership & Capability
 * Persistence Arc.
 *
 * Alpha 838 — compared:
 *   A. rewrite a mutable record — REJECTED: every append-only backend in
 *      this codebase is insert-only (Alpha 752/796/829 precedent);
 *      rewriting would require a NEW rewrite primitive this Arc's own
 *      instruction forbids inventing.
 *   B. append full snapshots on every change — REJECTED: a snapshot
 *      keyed by `capabilityId` alone would collide as `"conflict"` on
 *      the SECOND (different) write for the same id, the exact problem
 *      Membership persistence (Alpha 827) already avoided.
 *   C. append immutable events (`issued` / `redeemed`) — ADOPTED,
 *      directly reusing the ALREADY-COMPLETE, ALREADY-REVIEWED
 *      `FedosPayloadRetentionPersistence` pattern (Alpha 795/796):
 *      every fact is its own immutable record, uniquely keyed so a
 *      second write for the SAME fact is naturally idempotent and a
 *      second write for a DIFFERENT fact never collides.
 *   D. a separate observation log — REJECTED: Alpha 787 (already
 *      complete) already declined a speculative Observation layer for
 *      the in-memory Capability Authority; this Arc's own durable
 *      backend has no different justification for one.
 *
 * `"exhausted"`/`"revoked"` are DELIBERATELY NOT separate event types.
 * `"exhausted"` is a DERIVED fact (count of distinct `"redeemed"`
 * events `>= maxUses`) — the in-memory Capability Authority (Alpha 786,
 * frozen) already computes it this way (`redeemedByParticipantKeys.size
 * >= maxUses`), never stores it as its own flag; this file's durable
 * version reuses the identical reasoning. `"revoked"` has NO
 * corresponding operation anywhere in the frozen Alpha 761–790
 * Capability Authority contract — inventing a revoke-capability event
 * here would be new lifecycle scope this Arc's own objective
 * (durability, not new operations) does not call for.
 *
 * `"issued"` is keyed by `capabilityId` alone (at most one ever
 * exists). `"redeemed"` is keyed by `(capabilityId, redeemerAuthority,
 * redeemerPublicIdentifier)` — mirrors the in-memory Authority's own
 * `Set<string>` de-duplication key EXACTLY, so a duplicate redemption
 * attempt by the SAME redeemer collides naturally at the SAME key,
 * while a DIFFERENT redeemer always produces a new key (a new "use").
 *
 * No plaintext bearer secret anywhere in either event — `bearerVerifier`
 * (Alpha 834/835) only.
 *
 * HARD GUARDRAILS:
 *   - `schemaVersion` is the literal numeric type `1`.
 *   - Every field a plain `string`/`number`/`null` — no nested object,
 *     matching `FedosPersistedConversationMembershipV1`'s own
 *     flattening discipline (Alpha 825).
 *   - This file defines TYPES ONLY — no function, no class.
 */

export interface FedosPersistedConversationCapabilityIssuedEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "issued";
  readonly capabilityId: string;
  readonly conversationId: string;
  readonly action: string;
  readonly issuerAuthority: string;
  readonly issuerPublicIdentifier: string;
  readonly issuerIdentityId: string | null;
  /** `null` for a general (any redeemer) capability -- mirrors `FedosConversationCapabilityDescriptor.intendedRecipient`'s own nullability (Alpha 777). */
  readonly intendedRecipientAuthority: string | null;
  readonly intendedRecipientPublicIdentifier: string | null;
  readonly intendedRecipientIdentityId: string | null;
  readonly maxUses: number;
  readonly expiresAt: number | null;
  readonly issuedAt: number;
  /** One-way hash of the bearer secret (Alpha 834/835) -- never the plaintext secret. */
  readonly bearerVerifier: string;
}

export interface FedosPersistedConversationCapabilityRedeemedEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "redeemed";
  readonly capabilityId: string;
  readonly redeemerAuthority: string;
  readonly redeemerPublicIdentifier: string;
  readonly redeemerIdentityId: string | null;
  readonly redeemedAt: number;
}

export type FedosPersistedConversationCapabilityEventV1 =
  | FedosPersistedConversationCapabilityIssuedEventV1
  | FedosPersistedConversationCapabilityRedeemedEventV1;

/**
 * The RECONSTRUCTED, current-state view `getCapability()`/
 * `listCapabilities()` return -- never itself written to a log as one
 * record; derived from replaying every event for one `capabilityId`
 * (Alpha 833's own "currentUses"/"terminal state" requirement).
 */
export interface FedosPersistedConversationCapabilityRecordV1 {
  readonly schemaVersion: 1;
  readonly capabilityId: string;
  readonly conversationId: string;
  readonly action: string;
  readonly issuerAuthority: string;
  readonly issuerPublicIdentifier: string;
  readonly issuerIdentityId: string | null;
  readonly intendedRecipientAuthority: string | null;
  readonly intendedRecipientPublicIdentifier: string | null;
  readonly intendedRecipientIdentityId: string | null;
  readonly maxUses: number;
  readonly expiresAt: number | null;
  readonly issuedAt: number;
  readonly bearerVerifier: string;
  /** Count of DISTINCT redeemers who have successfully redeemed -- derived, never itself an independently-written field. */
  readonly currentUses: number;
}

/** Deterministic key for an `"issued"` event -- at most one ever exists per capability. */
export function fedosConversationCapabilityIssuedEventKey(capabilityId: string): string {
  return `${capabilityId}::issued`;
}

/** Deterministic key for a `"redeemed"` event -- mirrors the in-memory Authority's own per-redeemer de-duplication (Alpha 786). */
export function fedosConversationCapabilityRedeemedEventKey(
  capabilityId: string,
  redeemerAuthority: string,
  redeemerPublicIdentifier: string,
): string {
  return `${capabilityId}::redeemed::${redeemerAuthority}::${redeemerPublicIdentifier}`;
}
