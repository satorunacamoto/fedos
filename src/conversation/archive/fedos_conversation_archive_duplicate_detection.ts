/**
 * Secure Runtime Alpha 1541–1610 ("Conversation Export, Restore, Archive
 * Foundation") — Archive Duplicate Detection.
 *
 * A READ-ONLY preflight report: for every record in a decrypted
 * `FedosConversationArchiveBundleV1`, reports whether an EQUIVALENT
 * record already exists in the target's five persistence ports —
 * WITHOUT writing anything. Complements `restoreFedosConversationArchiveBundle()`
 * (`./fedos_conversation_archive_restore.ts`), which already surfaces
 * the SAME distinction as a side effect of actually writing
 * (`"already-present"`/`"conflict"`, this codebase's own existing
 * write-result vocabulary); this file exists for a caller that wants
 * the answer BEFORE committing to a write — e.g. to decide whether an
 * Archive is worth importing at all, or to show a user a summary first.
 *
 * Every check reuses an EXISTING `get*`/`has*` port method — no new
 * lookup, no new persistence logic. A record already known equal to
 * what is already stored is reported `"duplicate"`; a record whose id
 * already exists but with DIFFERENT content is reported `"conflict"` —
 * the SAME two outcomes Restore's own write path would produce, just
 * determined here without ever calling a `put*` method.
 *
 * HARD GUARDRAILS:
 *   - No `put*`/write call anywhere in this file.
 *   - Never throws.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import { fedosPersistedConversationRecordsAreEqual } from "../persistence/fedos_conversation_persistence.js";
import type { FedosConversationPersistence } from "../persistence/fedos_conversation_persistence.js";
import { fedosPersistedConversationMembershipsAreEqual } from "../membership/persistence/fedos_conversation_membership_persistence.js";
import type { FedosConversationMembershipPersistence } from "../membership/persistence/fedos_conversation_membership_persistence.js";
import type { FedosConversationCapabilityPersistence } from "../capability/persistence/fedos_conversation_capability_persistence.js";
import { fedosPersistedConversationMessageEnvelopesAreEqual } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationMessageEnvelopePersistence } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationPayloadId } from "../payload_storage/fedos_conversation_payload_id.js";
import type { FedosConversationPayloadStorage } from "../payload_storage/fedos_conversation_payload_storage.js";
import type { FedosConversationArchiveBundleV1 } from "./fedos_conversation_archive_bundle.js";

export interface FedosConversationArchiveDuplicateDetectionDependencies {
  readonly conversationPersistence: FedosConversationPersistence;
  readonly membershipPersistence: FedosConversationMembershipPersistence;
  readonly capabilityPersistence: FedosConversationCapabilityPersistence;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
}

export type FedosConversationArchiveDuplicateStatus = "new" | "duplicate" | "conflict";

export interface FedosConversationArchiveDuplicateReportCounts {
  readonly new: number;
  readonly duplicate: number;
  readonly conflict: number;
}

export interface FedosConversationArchiveDuplicateReport {
  readonly conversation: FedosConversationArchiveDuplicateStatus;
  readonly memberships: FedosConversationArchiveDuplicateReportCounts;
  readonly capabilityEvents: FedosConversationArchiveDuplicateReportCounts;
  readonly envelopes: FedosConversationArchiveDuplicateReportCounts;
  readonly payloads: FedosConversationArchiveDuplicateReportCounts;
}

function zeroCounts(): { new: number; duplicate: number; conflict: number } {
  return { new: 0, duplicate: 0, conflict: 0 };
}

function tally(counts: ReturnType<typeof zeroCounts>, status: FedosConversationArchiveDuplicateStatus): void {
  if (status === "new") counts.new += 1;
  else if (status === "duplicate") counts.duplicate += 1;
  else counts.conflict += 1;
}

/** Read-only preflight report — see this file's own header. Never writes, never throws. */
export function detectFedosConversationArchiveDuplicates(
  bundle: FedosConversationArchiveBundleV1,
  deps: FedosConversationArchiveDuplicateDetectionDependencies,
): FedosConversationArchiveDuplicateReport {
  const existingConversation = deps.conversationPersistence.getConversation(bundle.conversationId as FedosConversationId);
  const conversationStatus: FedosConversationArchiveDuplicateStatus =
    existingConversation === null ? "new" : fedosPersistedConversationRecordsAreEqual(existingConversation, bundle.conversation) ? "duplicate" : "conflict";

  const membershipCounts = zeroCounts();
  for (const membership of bundle.memberships) {
    const existing = deps.membershipPersistence.getMembership(membership.id);
    tally(membershipCounts, existing === null ? "new" : fedosPersistedConversationMembershipsAreEqual(existing, membership) ? "duplicate" : "conflict");
  }

  const capabilityCounts = zeroCounts();
  for (const event of bundle.capabilityEvents) {
    if (event.eventType === "issued") {
      const existing = deps.capabilityPersistence.getCapability(event.capabilityId);
      tally(capabilityCounts, existing === null ? "new" : "duplicate");
    } else {
      const alreadyRedeemed = deps.capabilityPersistence.hasRedeemedEvent(event.capabilityId, event.redeemerAuthority, event.redeemerPublicIdentifier);
      tally(capabilityCounts, alreadyRedeemed ? "duplicate" : "new");
    }
  }

  const envelopeCounts = zeroCounts();
  for (const envelope of bundle.envelopes) {
    const existing = deps.envelopePersistence.getEnvelope(envelope.id);
    tally(envelopeCounts, existing === null ? "new" : fedosPersistedConversationMessageEnvelopesAreEqual(existing, envelope) ? "duplicate" : "conflict");
  }

  const payloadCounts = zeroCounts();
  for (const payload of bundle.payloads) {
    const existing = deps.payloadStorage.getDescriptor(payload.id as FedosConversationPayloadId);
    if (existing === null) {
      tally(payloadCounts, "new");
      continue;
    }
    const matches = existing.id === payload.id && existing.conversationId === payload.conversationId && existing.mediaType === payload.mediaType && existing.byteLength === payload.byteLength && existing.createdAt === payload.createdAt;
    tally(payloadCounts, matches ? "duplicate" : "conflict");
  }

  return {
    conversation: conversationStatus,
    memberships: membershipCounts,
    capabilityEvents: capabilityCounts,
    envelopes: envelopeCounts,
    payloads: payloadCounts,
  };
}
