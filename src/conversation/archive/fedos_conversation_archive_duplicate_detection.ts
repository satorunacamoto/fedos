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
import { fedosPersistedConversationDraftRecordsAreEqual } from "../construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationDraftPersistence } from "../construction/fedos_conversation_draft_persistence.js";
import { isFedosConversationArchiveDirectConversationSubject } from "./fedos_conversation_archive_direct_subject.js";
import { fedosPersistedConversationMembershipsAreEqual } from "../membership/persistence/fedos_conversation_membership_persistence.js";
import type { FedosConversationMembershipPersistence } from "../membership/persistence/fedos_conversation_membership_persistence.js";
import type { FedosConversationCapabilityPersistence } from "../capability/persistence/fedos_conversation_capability_persistence.js";
import { fedosPersistedConversationMessageEnvelopesAreEqual } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationMessageEnvelopePersistence } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationPayloadId } from "../payload_storage/fedos_conversation_payload_id.js";
import type { FedosConversationPayloadStorage } from "../payload_storage/fedos_conversation_payload_storage.js";
import { fedosGroupGenerationRecordsAreEqual, type FedosGroupGenerationPersistence } from "../group/fedos_group_generation.js";
import { fedosGroupDirectPathRecordsAreEqual, type FedosGroupDirectPathPersistence } from "../group/fedos_group_direct_path.js";
import { fedosGroupMessageRecordsAreEqual, type FedosGroupMessagePersistence } from "../group/fedos_group_message.js";
import { fedosGroupFanoutDeliveryRecordsAreEqual, type FedosGroupFanoutDeliveryPersistence } from "../group/fedos_group_fanout_delivery.js";
import type { FedosConversationArchiveBundleV1 } from "./fedos_conversation_archive_bundle.js";
import type { FedosConversationArchiveGroupSectionV1 } from "./fedos_conversation_archive_group_section.js";

/** Secure Runtime Alpha 1921–1980 — the four Group-only ports this preflight needs to check Group facts. OPTIONAL: omitted, a bundle carrying a `group` section simply has no `group` report produced (mirrors the Collector's/Restore's own identical discipline). */
export interface FedosConversationArchiveGroupDuplicateDetectionDependencies {
  readonly groupGenerationPersistence: FedosGroupGenerationPersistence;
  readonly groupDirectPathPersistence: FedosGroupDirectPathPersistence;
  readonly groupMessagePersistence: FedosGroupMessagePersistence;
  readonly groupFanoutDeliveryPersistence: FedosGroupFanoutDeliveryPersistence;
}

export interface FedosConversationArchiveDuplicateDetectionDependencies {
  readonly conversationPersistence: FedosConversationPersistence;
  /** Secure Runtime Alpha 7801-7880 — OPTIONAL. Consulted ONLY when `bundle.conversation` is a Direct subject (`kind: "direct"`), mirroring the Collector's own identical dual-path discipline. Omitted, a Direct bundle's own conversation status cannot be determined and is reported `"new"` (fail-open toward "would insert", never a false `"conflict"`/`"duplicate"` claim) -- callers wanting an accurate Direct preflight answer must supply this. */
  readonly draftPersistence?: FedosConversationDraftPersistence;
  readonly membershipPersistence: FedosConversationMembershipPersistence;
  readonly capabilityPersistence: FedosConversationCapabilityPersistence;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  readonly group?: FedosConversationArchiveGroupDuplicateDetectionDependencies;
}

export type FedosConversationArchiveDuplicateStatus = "new" | "duplicate" | "conflict";

export interface FedosConversationArchiveDuplicateReportCounts {
  readonly new: number;
  readonly duplicate: number;
  readonly conflict: number;
}

/** Secure Runtime Alpha 1921–1980 — the Group Section's own per-domain preflight report, present iff `bundle.group` was present AND `deps.group` was supplied. `childConversations` is one FULL nested report per child Direct Conversation bundle, in the SAME order as `bundle.group.childConversations`. */
export interface FedosConversationArchiveGroupDuplicateReport {
  readonly generations: FedosConversationArchiveDuplicateReportCounts;
  readonly paths: FedosConversationArchiveDuplicateReportCounts;
  readonly childConversations: readonly FedosConversationArchiveDuplicateReport[];
  readonly messages: FedosConversationArchiveDuplicateReportCounts;
  readonly fanoutDeliveries: FedosConversationArchiveDuplicateReportCounts;
}

export interface FedosConversationArchiveDuplicateReport {
  readonly conversation: FedosConversationArchiveDuplicateStatus;
  readonly memberships: FedosConversationArchiveDuplicateReportCounts;
  readonly capabilityEvents: FedosConversationArchiveDuplicateReportCounts;
  readonly envelopes: FedosConversationArchiveDuplicateReportCounts;
  readonly payloads: FedosConversationArchiveDuplicateReportCounts;
  readonly group?: FedosConversationArchiveGroupDuplicateReport;
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
  let conversationStatus: FedosConversationArchiveDuplicateStatus;
  if (isFedosConversationArchiveDirectConversationSubject(bundle.conversation)) {
    const existingDraft = deps.draftPersistence?.getDraft(bundle.conversationId as FedosConversationId) ?? null;
    conversationStatus =
      existingDraft === null
        ? "new"
        : fedosPersistedConversationDraftRecordsAreEqual(existingDraft, bundle.conversation.record)
          ? "duplicate"
          : "conflict";
  } else {
    const existingConversation = deps.conversationPersistence.getConversation(bundle.conversationId as FedosConversationId);
    conversationStatus =
      existingConversation === null ? "new" : fedosPersistedConversationRecordsAreEqual(existingConversation, bundle.conversation) ? "duplicate" : "conflict";
  }

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

  const groupSection = bundle.group;
  const groupDeps = deps.group;
  const group =
    groupSection !== undefined && groupDeps !== undefined
      ? detectFedosConversationArchiveGroupDuplicates(groupSection, { ...deps, group: groupDeps })
      : undefined;

  return {
    conversation: conversationStatus,
    memberships: membershipCounts,
    capabilityEvents: capabilityCounts,
    envelopes: envelopeCounts,
    payloads: payloadCounts,
    ...(group !== undefined ? { group } : {}),
  };
}

function detectFedosConversationArchiveGroupDuplicates(
  section: FedosConversationArchiveGroupSectionV1,
  deps: FedosConversationArchiveDuplicateDetectionDependencies & { readonly group: FedosConversationArchiveGroupDuplicateDetectionDependencies },
): FedosConversationArchiveGroupDuplicateReport {
  const generationCounts = zeroCounts();
  for (const generation of section.generations) {
    const existing = deps.group.groupGenerationPersistence.getGeneration(generation.generationId);
    tally(generationCounts, existing === null ? "new" : fedosGroupGenerationRecordsAreEqual(existing, generation) ? "duplicate" : "conflict");
  }

  const pathCounts = zeroCounts();
  for (const path of section.paths) {
    const existing = deps.group.groupDirectPathPersistence.getPath(path.pathId);
    tally(pathCounts, existing === null ? "new" : fedosGroupDirectPathRecordsAreEqual(existing, path) ? "duplicate" : "conflict");
  }

  const messageCounts = zeroCounts();
  for (const message of section.messages) {
    const existing = deps.group.groupMessagePersistence.getMessage(message.id);
    tally(messageCounts, existing === null ? "new" : fedosGroupMessageRecordsAreEqual(existing, message) ? "duplicate" : "conflict");
  }

  const fanoutDeliveryCounts = zeroCounts();
  for (const delivery of section.fanoutDeliveries) {
    const existing = deps.group.groupFanoutDeliveryPersistence.getDelivery(delivery.groupMessageId, delivery.recipientMembershipId);
    tally(fanoutDeliveryCounts, existing === null ? "new" : fedosGroupFanoutDeliveryRecordsAreEqual(existing, delivery) ? "duplicate" : "conflict");
  }

  const childConversations = section.childConversations.map((child) => detectFedosConversationArchiveDuplicates(child, deps));

  return {
    generations: generationCounts,
    paths: pathCounts,
    childConversations,
    messages: messageCounts,
    fanoutDeliveries: fanoutDeliveryCounts,
  };
}
