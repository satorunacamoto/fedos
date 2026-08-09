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

import { deserializeFedosConversationRecord, serializeFedosConversationRecord } from "../../../../conversation/persistence/fedos_conversation_record_codec.js";
import type { FedosConversationPersistence } from "../../../../conversation/persistence/fedos_conversation_persistence.js";
import { deserializeFedosConversationDraftRecord, serializeFedosConversationDraftRecord } from "../../../../conversation/construction/fedos_conversation_draft_record_codec.js";
import type { FedosConversationDraftPersistence } from "../../../../conversation/construction/fedos_conversation_draft_persistence.js";
import { isFedosConversationArchiveDirectConversationSubject } from "../../../../conversation/archive/fedos_conversation_archive_direct_subject.js";
import { deserializeFedosConversationMembership, serializeFedosConversationMembership } from "../../../../conversation/membership/persistence/fedos_conversation_membership_codec.js";
import type { FedosConversationMembershipPersistence } from "../../../../conversation/membership/persistence/fedos_conversation_membership_persistence.js";
import {
  deserializeFedosConversationCapabilityIssuedEvent,
  deserializeFedosConversationCapabilityRedeemedEvent,
  serializeFedosConversationCapabilityIssuedEvent,
  serializeFedosConversationCapabilityRedeemedEvent,
} from "../../../../conversation/capability/persistence/fedos_conversation_capability_codec.js";
import type { FedosConversationCapabilityPersistence } from "../../../../conversation/capability/persistence/fedos_conversation_capability_persistence.js";
import { deserializeFedosConversationMessageEnvelope, serializeFedosConversationMessageEnvelope } from "../../../../conversation/envelope/persistence/fedos_conversation_message_envelope_codec.js";
import type { FedosConversationMessageEnvelopePersistence } from "../../../../conversation/envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import { deserializeFedosConversationPayload } from "../../../../conversation/payload_storage/fedos_conversation_payload_codec.js";
import type { FedosConversationPayloadStorage } from "../../../../conversation/payload_storage/fedos_conversation_payload_storage.js";
import type { FedosPayloadRetentionAuthority } from "../../../../conversation/retention/fedos_payload_retention_authority.js";
import type { FedosArchiveSuppressionObservationAuthority } from "../../../../conversation/retention/fedos_archive_suppression_observation_authority.js";
import { validateFedosGroupGenerationRecord, type FedosGroupGenerationPersistence } from "../../../../conversation/group/fedos_group_generation.js";
import { validateFedosGroupDirectPathRecord, type FedosGroupDirectPathPersistence } from "../../../../conversation/group/fedos_group_direct_path.js";
import { validateFedosGroupMessageRecord, type FedosGroupMessagePersistence } from "../../../../conversation/group/fedos_group_message.js";
import { validateFedosGroupFanoutDeliveryRecord, type FedosGroupFanoutDeliveryPersistence } from "../../../../conversation/group/fedos_group_fanout_delivery.js";
import type { FedosConversationArchiveBundleV1 } from "../../../../conversation/archive/fedos_conversation_archive_bundle.js";
import type { FedosConversationArchiveGroupSectionV1 } from "../../../../conversation/archive/fedos_conversation_archive_group_section.js";

/** Secure Runtime Alpha 1921–1980 — the four Group-only persistence ports Restore needs to replay `FedosConversationArchiveBundleV1.group`. OPTIONAL: omitted, a bundle carrying a `group` section simply has that section skipped entirely (never partially written) — mirrors the Collector's own identical "omit `deps.group`, get Direct-only behavior" discipline. */
export interface FedosConversationArchiveGroupRestoreDependencies {
  readonly groupGenerationPersistence: FedosGroupGenerationPersistence;
  readonly groupDirectPathPersistence: FedosGroupDirectPathPersistence;
  readonly groupMessagePersistence: FedosGroupMessagePersistence;
  readonly groupFanoutDeliveryPersistence: FedosGroupFanoutDeliveryPersistence;
}

export interface FedosConversationArchiveRestoreDependencies {
  readonly conversationPersistence: FedosConversationPersistence;
  /**
   * Secure Runtime Alpha 7801-7880 — OPTIONAL. Consulted ONLY when
   * `bundle.conversation` is a Direct subject (`kind: "direct"`,
   * `./fedos_conversation_archive_direct_subject.ts`) — writes ONLY the
   * DRAFT record (history/identity), never an Activation fact: restoring
   * an Archive must never silently mark a Conversation "active" or
   * establish a live Ratchet session as a side effect (Phase F's own
   * "history recovery and live-session recovery remain separate" rule)
   * — a restored Direct Conversation's own history becomes visible and
   * inspectable again, but sending a NEW message still requires the
   * normal, real activation/session-establishment flow, exactly as it
   * would for any other draft with no completed Activation fact yet.
   * Omitted, a Direct bundle's own `conversation` record is tallied
   * `"invalid"` (this dependency was not wired) rather than silently
   * dropped or misfiled as a Board record — mirrors every other OPTIONAL
   * dependency's own "omitted, byte-for-byte unchanged/disclosed"
   * discipline in this file.
   */
  readonly draftPersistence?: FedosConversationDraftPersistence;
  readonly membershipPersistence: FedosConversationMembershipPersistence;
  readonly capabilityPersistence: FedosConversationCapabilityPersistence;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  readonly group?: FedosConversationArchiveGroupRestoreDependencies;
  /**
   * Secure Runtime Alpha 7481-7560 (FedOS Archive Envelope Retention
   * Parity and Metadata Deletion Semantics Arc) — OPTIONAL, additive
   * defense-in-depth: re-evaluates the RESTORING device's own CURRENT
   * retention state for each incoming Envelope/Payload pair (keyed off
   * the Envelope's own `payloadId`) BEFORE writing either. An
   * Archive-carried record whose Payload this device has already
   * tombstoned/removed is never written back, regardless of what the
   * Archive itself contains — an Archive's own bundled content can never
   * grant access this device's own live Retention Authority currently
   * denies. Deliberately gated by `evaluateRetentionDecisionOnly()`, NOT
   * `evaluatePayloadAccess()`: the restoring device's own Payload Storage
   * is empty-by-construction for a record restore has not yet written,
   * so a storage-existence-gated check could never distinguish "already
   * informed, bytes just not restored yet" from "genuinely foreign" (see
   * `isPayloadPermittedForRestore()`'s own header below for the full
   * defect history). `"active"` (no decision on file for this Payload —
   * either genuinely foreign, or never denied) does NOT block restore —
   * see the Legacy/Foreign-Restore doc for why: a foreign/new profile has
   * no basis to deny something it never knew about. Omitted entirely,
   * restore behavior is BYTE-FOR-BYTE UNCHANGED from before this Arc. A
   * thrown/unavailable Authority is treated as denied, never as "no gate
   * configured, allow everything" — mirrors the Collector's own identical
   * `isPayloadPermitted()` discipline.
   */
  readonly retentionAuthority?: Pick<FedosPayloadRetentionAuthority, "evaluatePayloadAccess" | "evaluateRetentionDecisionOnly">;
  /**
   * Secure Runtime Alpha 7721-7800 (FedOS Archive Multi-Device
   * Suppression Propagation Arc) — OPTIONAL, additive, second and
   * independent gate alongside `retentionAuthority` above. Where
   * `retentionAuthority` answers "has THIS device's own local decision
   * denied this payload," this answers "has this device IMPORTED a
   * trusted suppression fact — from another of this account's own
   * Devices — denying it," closing the ONE limitation `feff676` itself
   * named and deferred: a same-account Device that was offline (or
   * never independently observed the deletion) when a sibling Device
   * decided to tombstone a payload has no LOCAL retention decision of
   * its own, yet must still refuse to resurrect that payload once it has
   * received the sibling's own suppression fact. Never merged into
   * `retentionAuthority`'s own log or evaluator — the two remain
   * entirely separate objects/logs by construction (Phase A
   * reconciliation report's own decision: "local decision and imported
   * observation remain distinguishable"). Omitted entirely, restore
   * behavior is BYTE-FOR-BYTE UNCHANGED from `feff676`.
   */
  readonly suppressionAuthority?: Pick<FedosArchiveSuppressionObservationAuthority, "evaluateSuppression">;
}

/** Secure Runtime Alpha 7481-7560 -- `"denied"` is a NEW outcome, distinct from `"invalid"`: the record is structurally well-formed and passed deep validation, but this device's own CURRENT retention state forbids writing it. Never conflated with a validation failure. */
export type FedosConversationArchiveSingleRecordOutcome = "inserted" | "duplicate" | "conflict" | "failed" | "invalid" | "denied";

export interface FedosConversationArchiveRestoreOutcomeCounts {
  readonly inserted: number;
  readonly duplicate: number;
  readonly conflict: number;
  readonly failed: number;
  readonly invalid: number;
  readonly denied: number;
}

/**
 * Fail-closed. Deliberately uses `evaluateRetentionDecisionOnly()`, NOT
 * `evaluatePayloadAccess()`: the latter gates on this device's own
 * Payload Storage containing a descriptor for `payloadId` FIRST, which
 * is ALWAYS empty for a payload restore has not yet written -- exactly
 * the record this gate exists to check before it is written. Using
 * `evaluatePayloadAccess()` here would make every fresh restore
 * indistinguishable from "genuinely foreign," silently defeating
 * restore-time re-evaluation entirely (Alpha 7481-7560's own
 * self-discovered defect, fixed here). `evaluateRetentionDecisionOnly()`
 * answers the actual question: does this device's own retention LOG
 * already carry a tombstoned/payload-removed decision for this
 * payloadId, independent of whatever bytes currently exist in storage.
 * `"active"` (no decision on file -- either genuinely foreign, or this
 * exact payload was never denied) is permitted; `"tombstoned"` /
 * `"payload-removed"` are denied; a thrown/unavailable Authority is
 * treated as denied, never as "no gate configured, allow everything."
 */
function isPayloadPermittedForRestore(
  retentionAuthority: Pick<FedosPayloadRetentionAuthority, "evaluateRetentionDecisionOnly">,
  payloadId: Parameters<FedosPayloadRetentionAuthority["evaluateRetentionDecisionOnly"]>[0],
  suppressionAuthority?: Pick<FedosArchiveSuppressionObservationAuthority, "evaluateSuppression">,
): boolean {
  try {
    if (retentionAuthority.evaluateRetentionDecisionOnly(payloadId) !== "active") return false;
  } catch {
    return false;
  }
  // Secure Runtime Alpha 7721-7800 -- second, independent gate (see this
  // file's own `suppressionAuthority` dependency doc comment). Local
  // retention passing is necessary but not sufficient: an imported,
  // trusted suppression fact from a sibling Device denies restore even
  // when this device's OWN retention log has never heard of the payload.
  if (suppressionAuthority === undefined) return true;
  try {
    return suppressionAuthority.evaluateSuppression(payloadId, "restore") === "active";
  } catch {
    return false;
  }
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

function zeroCounts(): { inserted: number; duplicate: number; conflict: number; failed: number; invalid: number; denied: number } {
  return { inserted: 0, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 0 };
}

function tally(counts: ReturnType<typeof zeroCounts>, outcome: FedosConversationArchiveSingleRecordOutcome): void {
  if (outcome === "inserted") counts.inserted += 1;
  else if (outcome === "duplicate") counts.duplicate += 1;
  else if (outcome === "conflict") counts.conflict += 1;
  else if (outcome === "failed") counts.failed += 1;
  else if (outcome === "denied") counts.denied += 1;
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
  // Secure Runtime Alpha 7801-7880 -- a Direct subject (`kind: "direct"`)
  // writes ONLY the draft record, via `deps.draftPersistence`, never
  // `conversationPersistence` (that port's own validator hard-rejects
  // any non-"public" mode -- writing a Direct record there would either
  // be rejected as invalid or, worse, silently misfiled as a Board
  // conversation, exactly the "Board/Direct identity conflation" this
  // Arc's own mission forbids). A bare (no `kind`) subject is the
  // pre-existing Board shape, written exactly as before.
  let conversationOutcome: FedosConversationArchiveSingleRecordOutcome;
  if (isFedosConversationArchiveDirectConversationSubject(bundle.conversation)) {
    const draftRuntime = deserializeFedosConversationDraftRecord(bundle.conversation.record);
    conversationOutcome =
      draftRuntime === null || deps.draftPersistence === undefined
        ? "invalid"
        : fromWriteResult(deps.draftPersistence.putDraft(serializeFedosConversationDraftRecord(draftRuntime)));
  } else {
    const conversationRuntime = deserializeFedosConversationRecord(bundle.conversation);
    conversationOutcome =
      conversationRuntime === null ? "invalid" : fromWriteResult(deps.conversationPersistence.putConversation(serializeFedosConversationRecord(conversationRuntime)));
  }

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

  // Secure Runtime Alpha 7481-7560 -- defense-in-depth: re-evaluates the
  // RESTORING device's own CURRENT retention state for each Envelope's
  // own `payloadId` BEFORE writing it, symmetric with the Collector's own
  // export-side gate. An Archive-carried Envelope can never grant access
  // this device's own live Retention Authority currently denies -- see
  // `isPayloadPermittedForRestore()`'s own header for the `"not-found"`
  // (foreign/new profile) exception.
  const envelopeCounts = zeroCounts();
  for (const raw of bundle.envelopes) {
    const runtime = deserializeFedosConversationMessageEnvelope(raw);
    if (runtime === null) {
      tally(envelopeCounts, "invalid");
      continue;
    }
    if (
      deps.retentionAuthority !== undefined &&
      !isPayloadPermittedForRestore(deps.retentionAuthority, runtime.payloadId, deps.suppressionAuthority)
    ) {
      tally(envelopeCounts, "denied");
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
    if (
      deps.retentionAuthority !== undefined &&
      !isPayloadPermittedForRestore(deps.retentionAuthority, decoded.descriptor.id, deps.suppressionAuthority)
    ) {
      tally(payloadCounts, "denied");
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
