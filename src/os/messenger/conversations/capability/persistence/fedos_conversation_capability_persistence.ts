/**
 * Secure Runtime Alpha 837 ("Capability Persistence Port") — Stage 5 of
 * Phase C of the Alpha 821–850 Durable Conversation Membership &
 * Capability Persistence Arc.
 *
 * Because `currentUses` changes with every redemption, an insert-only
 * append-only backend cannot use "immutable insert-only semantics" in
 * the naive single-record-per-id sense (Alpha 837's own explicit
 * instruction) — this port instead stores EVENTS (Alpha 838:
 * `"issued"`/`"redeemed"`, `./fedos_persisted_conversation_capability_v1.ts`)
 * and reconstructs the current, `currentUses`-bearing view on read.
 *
 * `putEvent()` accepts either event kind through one method — mirrors
 * `FedosPayloadRetentionPersistence.putDecision()`'s own single-method,
 * multi-action-kind shape (Alpha 795/796) rather than inventing two
 * parallel write methods.
 *
 * `hasRedeemedEvent()` — added while implementing the Alpha 841 Durable
 * Capability Authority. `getCapability()`'s reconstructed
 * `currentUses` is a COUNT only; it cannot tell "this specific redeemer
 * already redeemed" from "some OTHER redeemer already used the last
 * slot" — exactly the distinction `redeem()`'s own step 1 ("validate
 * WITHOUT mutation") needs before ever attempting a write, mirroring
 * `InMemoryFedosConversationCapabilityAuthority`'s own O(1)
 * `redeemedByParticipantKeys.has()` check (Alpha 786, frozen). A small,
 * additive port method — this port has no other consumer yet outside
 * this same Arc, so extending it here is not a ripple into
 * already-accepted, already-merged surface.
 *
 * `listConversationCapabilityEvents()` — added for Secure Runtime Alpha
 * 1541–1610 (Conversation Export, Restore, Archive Foundation), the
 * SAME additive-port precedent `hasRedeemedEvent()` already set: a new
 * consumer (Archive Export/Restore) genuinely needs the RAW `"issued"`/
 * `"redeemed"` events, not the reconstructed current-state view
 * `listConversationCapabilities()` returns — a reconstructed record's
 * `currentUses` is a COUNT only and cannot be replayed back into a
 * fresh backend without losing WHICH distinct redeemers already used a
 * slot (silently permitting a double-redemption after restore). No
 * existing caller or contract changes; this is a pure addition.
 */

import {
  fedosConversationCapabilityIssuedEventKey,
  fedosConversationCapabilityRedeemedEventKey,
  type FedosPersistedConversationCapabilityEventV1,
  type FedosPersistedConversationCapabilityIssuedEventV1,
  type FedosPersistedConversationCapabilityRecordV1,
  type FedosPersistedConversationCapabilityRedeemedEventV1,
} from "../../../../../conversation/capability/persistence/fedos_persisted_conversation_capability_v1.js";

/** Mirrors `FedosConversationPersistenceWriteResult` exactly (Alpha 749). */
export type FedosConversationCapabilityPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosConversationCapabilityPersistence {
  putEvent(event: FedosPersistedConversationCapabilityEventV1): FedosConversationCapabilityPersistenceWriteResult;
  /** Resolves the CURRENT reconstructed record for one capability id -- `null` if no `"issued"` event exists. */
  getCapability(capabilityId: string): FedosPersistedConversationCapabilityRecordV1 | null;
  listCapabilities(): readonly FedosPersistedConversationCapabilityRecordV1[];
  listConversationCapabilities(conversationId: string): readonly FedosPersistedConversationCapabilityRecordV1[];
  /** `true` iff a `"redeemed"` event already exists for this exact `(capabilityId, redeemer)` pair. See this file's own header. */
  hasRedeemedEvent(capabilityId: string, redeemerAuthority: string, redeemerPublicIdentifier: string): boolean;
  /** Every raw `"issued"`/`"redeemed"` event for every capability ever issued for this conversation — see this file's own header (Alpha 1541–1610). */
  listConversationCapabilityEvents(conversationId: string): readonly FedosPersistedConversationCapabilityEventV1[];
}

/** The internal storage key for one event -- `"issued"` keyed by capability id alone; `"redeemed"` keyed by `(capabilityId, redeemer)`, mirroring the in-memory Authority's own per-redeemer Set (Alpha 786). */
export function fedosConversationCapabilityEventKey(event: FedosPersistedConversationCapabilityEventV1): string {
  if (event.eventType === "issued") return fedosConversationCapabilityIssuedEventKey(event.capabilityId);
  return fedosConversationCapabilityRedeemedEventKey(event.capabilityId, event.redeemerAuthority, event.redeemerPublicIdentifier);
}

/** Structural equality over every field of one event -- used to decide `"already-present"` vs `"conflict"` for a duplicate key. */
export function fedosPersistedConversationCapabilityEventsAreEqual(
  a: FedosPersistedConversationCapabilityEventV1,
  b: FedosPersistedConversationCapabilityEventV1,
): boolean {
  if (a.eventType !== b.eventType) return false;
  if (a.eventType === "issued" && b.eventType === "issued") {
    return (
      a.schemaVersion === b.schemaVersion &&
      a.capabilityId === b.capabilityId &&
      a.conversationId === b.conversationId &&
      a.action === b.action &&
      a.issuerAuthority === b.issuerAuthority &&
      a.issuerPublicIdentifier === b.issuerPublicIdentifier &&
      a.issuerIdentityId === b.issuerIdentityId &&
      a.intendedRecipientAuthority === b.intendedRecipientAuthority &&
      a.intendedRecipientPublicIdentifier === b.intendedRecipientPublicIdentifier &&
      a.intendedRecipientIdentityId === b.intendedRecipientIdentityId &&
      a.maxUses === b.maxUses &&
      a.expiresAt === b.expiresAt &&
      a.issuedAt === b.issuedAt &&
      a.bearerVerifier === b.bearerVerifier
    );
  }
  const redeemedA = a as FedosPersistedConversationCapabilityRedeemedEventV1;
  const redeemedB = b as FedosPersistedConversationCapabilityRedeemedEventV1;
  return (
    redeemedA.schemaVersion === redeemedB.schemaVersion &&
    redeemedA.capabilityId === redeemedB.capabilityId &&
    redeemedA.redeemerAuthority === redeemedB.redeemerAuthority &&
    redeemedA.redeemerPublicIdentifier === redeemedB.redeemerPublicIdentifier &&
    redeemedA.redeemerIdentityId === redeemedB.redeemerIdentityId &&
    redeemedA.redeemedAt === redeemedB.redeemedAt
  );
}

/**
 * Reconstructs the current record for one capability id from every
 * event found for it. `null` if no `"issued"` event exists yet.
 * `currentUses` is the count of DISTINCT `"redeemed"` events -- exactly
 * mirroring the in-memory Authority's own `Set<string>.size`.
 */
export function reconstructFedosConversationCapabilityRecord(
  eventsForId: readonly FedosPersistedConversationCapabilityEventV1[],
): FedosPersistedConversationCapabilityRecordV1 | null {
  const issued = eventsForId.find((event): event is FedosPersistedConversationCapabilityIssuedEventV1 => event.eventType === "issued") ?? null;
  if (issued === null) return null;

  const redeemedCount = eventsForId.filter((event) => event.eventType === "redeemed").length;

  return {
    schemaVersion: 1,
    capabilityId: issued.capabilityId,
    conversationId: issued.conversationId,
    action: issued.action,
    issuerAuthority: issued.issuerAuthority,
    issuerPublicIdentifier: issued.issuerPublicIdentifier,
    issuerIdentityId: issued.issuerIdentityId,
    intendedRecipientAuthority: issued.intendedRecipientAuthority,
    intendedRecipientPublicIdentifier: issued.intendedRecipientPublicIdentifier,
    intendedRecipientIdentityId: issued.intendedRecipientIdentityId,
    maxUses: issued.maxUses,
    expiresAt: issued.expiresAt,
    issuedAt: issued.issuedAt,
    bearerVerifier: issued.bearerVerifier,
    currentUses: redeemedCount,
  };
}
