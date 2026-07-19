/**
 * Secure Runtime Alpha 1541–1610 ("Conversation Export, Restore, Archive
 * Foundation") — Archive Restore.
 *
 * The WRITE side of Import: replays a decrypted `FedosConversationArchiveBundleV1`
 * back into the five EXISTING, unmodified persistence ports. Every
 * record is independently, deeply re-validated by reusing that record's
 * OWN existing `deserializeX`/`validateX` function — the bundle codec's
 * own coarse structural parse (`fedos_conversation_archive_bundle_codec.ts`)
 * is deliberately not trusted alone. A record that fails this deep
 * validation is counted `invalid` and skipped; it never aborts the rest
 * of the Restore (a partially-invalid Archive should not block restoring
 * every record that IS valid).
 *
 * Per-record flow (identical shape across all four child domains):
 *   raw wire record -> `deserializeX()` (deep validate, reused) -> `null`? tally `invalid`, skip
 *                    -> `serializeX()` (re-derive canonical wire form, reused) -> `port.putX()`
 *                    -> "inserted" | "already-present" | "conflict" | "failed", tallied
 *
 * Duplicate Detection falls directly out of this loop's own outcome
 * tally: `"already-present"` (`duplicate`) and `"conflict"` (`conflict`)
 * are this codebase's OWN EXISTING write-result vocabulary (Alpha
 * 315/749/804/827/837/857), never a new one invented for this Arc — see
 * `fedos_conversation_archive_duplicate_detection.ts` for the
 * complementary READ-ONLY preflight report (no port write) built from
 * the SAME existing ports' own `get*`/`has*` methods.
 *
 * HARD GUARDRAILS:
 *   - Never deletes, never overwrites, never rewrites — every write goes
 *     through the target port's OWN `put*` method, whose own
 *     already-established idempotent/conflict semantics govern the
 *     outcome; this file invents no new persistence behavior.
 *   - Payload bytes are restored via `putPayload(descriptor, bytes)` —
 *     the SAME two-argument shape `FedosConversationPayloadStorage`
 *     already requires (Alpha 804); `deserializeFedosConversationPayload`
 *     already returns exactly that `{ descriptor, bytes }` shape.
 *   - Never throws.
 */

import { deserializeFedosConversationRecord, serializeFedosConversationRecord } from "../persistence/fedos_conversation_record_codec.js";
import type { FedosConversationPersistence } from "../persistence/fedos_conversation_persistence.js";
import { deserializeFedosConversationMembership, serializeFedosConversationMembership } from "../membership/persistence/fedos_conversation_membership_codec.js";
import type { FedosConversationMembershipPersistence } from "../membership/persistence/fedos_conversation_membership_persistence.js";
import {
  deserializeFedosConversationCapabilityIssuedEvent,
  deserializeFedosConversationCapabilityRedeemedEvent,
  serializeFedosConversationCapabilityIssuedEvent,
  serializeFedosConversationCapabilityRedeemedEvent,
} from "../capability/persistence/fedos_conversation_capability_codec.js";
import type { FedosConversationCapabilityPersistence } from "../capability/persistence/fedos_conversation_capability_persistence.js";
import { deserializeFedosConversationMessageEnvelope, serializeFedosConversationMessageEnvelope } from "../envelope/persistence/fedos_conversation_message_envelope_codec.js";
import type { FedosConversationMessageEnvelopePersistence } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import { deserializeFedosConversationPayload } from "../payload_storage/fedos_conversation_payload_codec.js";
import type { FedosConversationPayloadStorage } from "../payload_storage/fedos_conversation_payload_storage.js";
import { validateFedosGroupGenerationRecord, type FedosGroupGenerationPersistence } from "../group/fedos_group_generation.js";
import { validateFedosGroupDirectPathRecord, type FedosGroupDirectPathPersistence } from "../group/fedos_group_direct_path.js";
import { validateFedosGroupMessageRecord, type FedosGroupMessagePersistence } from "../group/fedos_group_message.js";
import { validateFedosGroupFanoutDeliveryRecord, type FedosGroupFanoutDeliveryPersistence } from "../group/fedos_group_fanout_delivery.js";
import type { FedosConversationArchiveBundleV1 } from "./fedos_conversation_archive_bundle.js";
import type { FedosConversationArchiveGroupSectionV1 } from "./fedos_conversation_archive_group_section.js";

/** Secure Runtime Alpha 1921–1980 — the four Group-only persistence ports Restore needs to replay `FedosConversationArchiveBundleV1.group`. OPTIONAL: omitted, a bundle carrying a `group` section simply has that section skipped entirely (never partially written) — mirrors the Collector's own identical "omit `deps.group`, get Direct-only behavior" discipline. */
export interface FedosConversationArchiveGroupRestoreDependencies {
  readonly groupGenerationPersistence: FedosGroupGenerationPersistence;
  readonly groupDirectPathPersistence: FedosGroupDirectPathPersistence;
  readonly groupMessagePersistence: FedosGroupMessagePersistence;
  readonly groupFanoutDeliveryPersistence: FedosGroupFanoutDeliveryPersistence;
}

export interface FedosConversationArchiveRestoreDependencies {
  readonly conversationPersistence: FedosConversationPersistence;
  readonly membershipPersistence: FedosConversationMembershipPersistence;
  readonly capabilityPersistence: FedosConversationCapabilityPersistence;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  readonly group?: FedosConversationArchiveGroupRestoreDependencies;
}

export type FedosConversationArchiveSingleRecordOutcome = "inserted" | "duplicate" | "conflict" | "failed" | "invalid";

export interface FedosConversationArchiveRestoreOutcomeCounts {
  readonly inserted: number;
  readonly duplicate: number;
  readonly conflict: number;
  readonly failed: number;
  readonly invalid: number;
}

/** Secure Runtime Alpha 1921–1980 — the Group Section's own per-domain outcome tally, present iff `bundle.group` was present AND `deps.group` was supplied. `childConversations` is one FULL nested `FedosConversationArchiveRestoreResult` per child Direct Conversation bundle, in the SAME order as `bundle.group.childConversations` — each restored through the SAME top-level replay logic this function already applies (new orchestration, never a second write path). */
export interface FedosConversationArchiveGroupRestoreResult {
  readonly generations: FedosConversationArchiveRestoreOutcomeCounts;
  readonly paths: FedosConversationArchiveRestoreOutcomeCounts;
  readonly childConversations: readonly FedosConversationArchiveRestoreResult[];
  readonly messages: FedosConversationArchiveRestoreOutcomeCounts;
  readonly fanoutDeliveries: FedosConversationArchiveRestoreOutcomeCounts;
}

export interface FedosConversationArchiveRestoreResult {
  readonly conversation: FedosConversationArchiveSingleRecordOutcome;
  readonly memberships: FedosConversationArchiveRestoreOutcomeCounts;
  readonly capabilityEvents: FedosConversationArchiveRestoreOutcomeCounts;
  readonly envelopes: FedosConversationArchiveRestoreOutcomeCounts;
  readonly payloads: FedosConversationArchiveRestoreOutcomeCounts;
  readonly group?: FedosConversationArchiveGroupRestoreResult;
}

function zeroCounts(): { inserted: number; duplicate: number; conflict: number; failed: number; invalid: number } {
  return { inserted: 0, duplicate: 0, conflict: 0, failed: 0, invalid: 0 };
}

function tally(counts: ReturnType<typeof zeroCounts>, outcome: FedosConversationArchiveSingleRecordOutcome): void {
  if (outcome === "inserted") counts.inserted += 1;
  else if (outcome === "duplicate") counts.duplicate += 1;
  else if (outcome === "conflict") counts.conflict += 1;
  else if (outcome === "failed") counts.failed += 1;
  else counts.invalid += 1;
}

function fromWriteResult(result: "inserted" | "already-present" | "conflict" | "failed"): FedosConversationArchiveSingleRecordOutcome {
  return result === "already-present" ? "duplicate" : result;
}

/**
 * Replays every record in `bundle` into `deps`'s five persistence
 * ports. Never throws — every failure mode (deep-validation failure,
 * port write failure) is reflected in the returned outcome tally.
 */
export function restoreFedosConversationArchiveBundle(
  bundle: FedosConversationArchiveBundleV1,
  deps: FedosConversationArchiveRestoreDependencies,
): FedosConversationArchiveRestoreResult {
  const conversationRuntime = deserializeFedosConversationRecord(bundle.conversation);
  const conversationOutcome: FedosConversationArchiveSingleRecordOutcome =
    conversationRuntime === null ? "invalid" : fromWriteResult(deps.conversationPersistence.putConversation(serializeFedosConversationRecord(conversationRuntime)));

  const membershipCounts = zeroCounts();
  for (const raw of bundle.memberships) {
    const runtime = deserializeFedosConversationMembership(raw);
    if (runtime === null) {
      tally(membershipCounts, "invalid");
      continue;
    }
    tally(membershipCounts, fromWriteResult(deps.membershipPersistence.putMembership(serializeFedosConversationMembership(runtime))));
  }

  const capabilityCounts = zeroCounts();
  for (const raw of bundle.capabilityEvents) {
    if (raw.eventType === "issued") {
      const decoded = deserializeFedosConversationCapabilityIssuedEvent(raw);
      if (decoded === null) {
        tally(capabilityCounts, "invalid");
        continue;
      }
      const event = serializeFedosConversationCapabilityIssuedEvent(decoded.descriptor, decoded.bearerVerifier);
      tally(capabilityCounts, fromWriteResult(deps.capabilityPersistence.putEvent(event)));
    } else {
      const decoded = deserializeFedosConversationCapabilityRedeemedEvent(raw);
      if (decoded === null) {
        tally(capabilityCounts, "invalid");
        continue;
      }
      const event = serializeFedosConversationCapabilityRedeemedEvent(decoded.capabilityId, decoded.redeemer, decoded.redeemedAt);
      tally(capabilityCounts, fromWriteResult(deps.capabilityPersistence.putEvent(event)));
    }
  }

  const envelopeCounts = zeroCounts();
  for (const raw of bundle.envelopes) {
    const runtime = deserializeFedosConversationMessageEnvelope(raw);
    if (runtime === null) {
      tally(envelopeCounts, "invalid");
      continue;
    }
    tally(envelopeCounts, fromWriteResult(deps.envelopePersistence.putEnvelope(serializeFedosConversationMessageEnvelope(runtime))));
  }

  const payloadCounts = zeroCounts();
  for (const raw of bundle.payloads) {
    const decoded = deserializeFedosConversationPayload(raw);
    if (decoded === null) {
      tally(payloadCounts, "invalid");
      continue;
    }
    tally(payloadCounts, fromWriteResult(deps.payloadStorage.putPayload(decoded.descriptor, decoded.bytes)));
  }

  // Secure Runtime Alpha 1921-1980 -- restores the Group Section ONLY when the bundle actually
  // carries one AND the caller supplied the Group ports. Order: generations -> paths -> child Direct
  // Conversations -> messages -> fanout deliveries -- mirrors the REAL dependency shape these domains
  // have (a path's own `directConversationId` is meaningful once the child exists; a fanout record's
  // own `pathId`/message id are meaningful once those exist) even though none of these append-only
  // ports actually ENFORCE a foreign-key check at write time -- every `put*` call here is independently
  // idempotent, exactly like the base five-domain loop above, so a restore interrupted after any ONE
  // domain converges cleanly on a fresh retry (never a duplicate, never an overwrite).
  const groupSection = bundle.group;
  const groupDeps = deps.group;
  const group =
    groupSection !== undefined && groupDeps !== undefined
      ? restoreFedosConversationArchiveGroupSection(groupSection, { ...deps, group: groupDeps })
      : undefined;

  return {
    conversation: conversationOutcome,
    memberships: membershipCounts,
    capabilityEvents: capabilityCounts,
    envelopes: envelopeCounts,
    payloads: payloadCounts,
    ...(group !== undefined ? { group } : {}),
  };
}

function restoreFedosConversationArchiveGroupSection(
  section: FedosConversationArchiveGroupSectionV1,
  deps: FedosConversationArchiveRestoreDependencies & { readonly group: FedosConversationArchiveGroupRestoreDependencies },
): FedosConversationArchiveGroupRestoreResult {
  const generationCounts = zeroCounts();
  for (const raw of section.generations) {
    const runtime = validateFedosGroupGenerationRecord(raw);
    if (runtime === null) {
      tally(generationCounts, "invalid");
      continue;
    }
    tally(generationCounts, fromWriteResult(deps.group.groupGenerationPersistence.putGeneration(runtime)));
  }

  const pathCounts = zeroCounts();
  for (const raw of section.paths) {
    const runtime = validateFedosGroupDirectPathRecord(raw);
    if (runtime === null) {
      tally(pathCounts, "invalid");
      continue;
    }
    tally(pathCounts, fromWriteResult(deps.group.groupDirectPathPersistence.putPathFact(runtime)));
  }

  const childConversations: FedosConversationArchiveRestoreResult[] = [];
  for (const child of section.childConversations) {
    childConversations.push(restoreFedosConversationArchiveBundle(child, deps));
  }

  const messageCounts = zeroCounts();
  for (const raw of section.messages) {
    const runtime = validateFedosGroupMessageRecord(raw);
    if (runtime === null) {
      tally(messageCounts, "invalid");
      continue;
    }
    tally(messageCounts, fromWriteResult(deps.group.groupMessagePersistence.putMessageFact(runtime)));
  }

  const fanoutDeliveryCounts = zeroCounts();
  for (const raw of section.fanoutDeliveries) {
    const runtime = validateFedosGroupFanoutDeliveryRecord(raw);
    if (runtime === null) {
      tally(fanoutDeliveryCounts, "invalid");
      continue;
    }
    tally(fanoutDeliveryCounts, fromWriteResult(deps.group.groupFanoutDeliveryPersistence.putDeliveryFact(runtime)));
  }

  return {
    generations: generationCounts,
    paths: pathCounts,
    childConversations,
    messages: messageCounts,
    fanoutDeliveries: fanoutDeliveryCounts,
  };
}
