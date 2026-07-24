/**
 * Secure Runtime Alpha 1541–1610 ("Conversation Export, Restore, Archive
 * Foundation") — Archive Collector.
 *
 * The READ side of Export: gathers one conversation's already-persisted
 * records out of the five EXISTING, unmodified ports
 * (`FedosConversationPersistence`, `FedosConversationMembershipPersistence`,
 * `FedosConversationCapabilityPersistence`, `FedosConversationMessageEnvelopePersistence`,
 * `FedosConversationPayloadStorage`) into one `FedosConversationArchiveBundleV1`
 * (`./fedos_conversation_archive_bundle.ts`). Pure orchestration — no new
 * persistence logic, no new validation, no mutation of any kind.
 *
 * Membership is collected via `listConversationMemberships()` — the
 * CURRENT record per id, not raw `(id, state)` history (that port
 * exposes no raw-event listing; see `fedos_conversation_archive_bundle.ts`'s
 * own header for why the current record alone is sufficient for a
 * correct Restore). Capability is collected via the Alpha 1541–1610
 * `listConversationCapabilityEvents()` addition — RAW events, for the
 * opposite reason (a reconstructed record's `currentUses` count cannot
 * be replayed back losslessly).
 *
 * Payload bytes are read one id at a time via `getPayload()` — mirrors
 * `FedosConversationPayloadStorage`'s own existing discipline (Alpha
 * 813: "a caller that wants bytes must call `getPayload` per id");
 * `listConversationPayloads()` alone only ever returns descriptors.
 *
 * `null` is returned, never thrown, if the conversation itself does not
 * exist in `conversationPersistence` — fail closed, matching every
 * existing lookup in this codebase.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationPersistence } from "../persistence/fedos_conversation_persistence.js";
import type { FedosConversationMembershipPersistence } from "../membership/persistence/fedos_conversation_membership_persistence.js";
import type { FedosConversationCapabilityPersistence } from "../capability/persistence/fedos_conversation_capability_persistence.js";
import type { FedosConversationMessageEnvelopePersistence } from "../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationPayloadStorage } from "../payload_storage/fedos_conversation_payload_storage.js";
import { serializeFedosConversationPayload } from "../payload_storage/fedos_conversation_payload_codec.js";
import type { FedosPayloadRetentionAuthority } from "../retention/fedos_payload_retention_authority.js";
import type { FedosGroupGenerationPersistence } from "../group/fedos_group_generation.js";
import type { FedosGroupDirectPathPersistence, FedosGroupDirectPathRecord } from "../group/fedos_group_direct_path.js";
import type { FedosGroupMessagePersistence } from "../group/fedos_group_message.js";
import type { FedosGroupFanoutDeliveryPersistence, FedosGroupFanoutDeliveryRecord } from "../group/fedos_group_fanout_delivery.js";
import type { FedosConversationArchiveBundleV1 } from "./fedos_conversation_archive_bundle.js";
import type { FedosConversationArchiveGroupSectionV1 } from "./fedos_conversation_archive_group_section.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "./fedos_conversation_archive_schema_version.js";

/** Secure Runtime Alpha 1921–1980 — the four Group-only persistence ports the Collector needs to additionally populate `FedosConversationArchiveBundleV1.group`. OPTIONAL on `FedosConversationArchiveCollectorDependencies` below: a caller archiving a plain Direct Conversation (or one who never wants Group support) omits this entirely and gets the IDENTICAL Direct-only bundle this codebase has always produced. */
export interface FedosConversationArchiveGroupCollectorDependencies {
  readonly groupGenerationPersistence: FedosGroupGenerationPersistence;
  readonly groupDirectPathPersistence: FedosGroupDirectPathPersistence;
  readonly groupMessagePersistence: FedosGroupMessagePersistence;
  readonly groupFanoutDeliveryPersistence: FedosGroupFanoutDeliveryPersistence;
}

export interface FedosConversationArchiveCollectorDependencies {
  readonly conversationPersistence: FedosConversationPersistence;
  readonly membershipPersistence: FedosConversationMembershipPersistence;
  readonly capabilityPersistence: FedosConversationCapabilityPersistence;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  /**
   * Secure Runtime Alpha 1921–1980 — OPTIONAL. Present iff the caller
   * wants Group archiving support at all. `collectFedosConversationArchiveBundle()`
   * still only ever POPULATES `group` when `conversationId` itself
   * resolves to a `"private-group"` Conversation record — supplying this
   * for a Direct conversationId is inert.
   */
  readonly group?: FedosConversationArchiveGroupCollectorDependencies;
  /**
   * Secure Runtime Alpha 7241-7320 — OPTIONAL, narrow, additive: the SAME
   * `Pick<FedosPayloadRetentionAuthority, "evaluatePayloadAccess">` gate
   * Search's own Alpha 2581-2620 fix already added to
   * `fedos_conversation_search_index.ts`. Closes the real, disclosed
   * design-vs-implementation drift a Release Readiness Review found at
   * commit `b4fa2d7f`: Archive export/restore never enforced retention at
   * all, even though the exact same contract ("once tombstoned/payload-
   * removed, a payload's bytes must not resurface") already applied to
   * Search. A payload whose `evaluatePayloadAccess()` is anything other
   * than `{ outcome: "allowed" }` (denied, tombstoned, payload-removed,
   * not-found, or a thrown/unavailable Authority — fails closed, mirrors
   * Search's own `#isPermitted()`) is silently excluded from the
   * collected bundle's own `payloads` array — never included, never a
   * placeholder.
   *
   * Secure Runtime Alpha 7481-7560 (FedOS Archive Envelope Retention
   * Parity and Metadata Deletion Semantics Arc) — this SAME field now
   * ALSO gates Envelope collection (below), keyed off each Envelope's own
   * `payloadId` — closing the exact gap a committed audit found
   * (`docs/reviews/archive_retention_deletion_audit_194dc448/00_archive_retention_deletion_audit.md`,
   * `2eed88d9`): Envelope and Payload collection were two independent,
   * unlinked loops, so an export taken AFTER a Payload was
   * tombstoned/removed still carried that message's full metadata
   * (existence, timestamp, sender, recipient, conversation, envelope id)
   * forward via its own untouched Envelope. Omitted entirely, this
   * collector's behavior is BYTE-FOR-BYTE UNCHANGED from before this Arc
   * (every existing caller that never wires retention keeps exporting
   * every envelope AND every payload, exactly as before).
   */
  readonly retentionAuthority?: Pick<FedosPayloadRetentionAuthority, "evaluatePayloadAccess" | "evaluateRetentionDecisionOnly">;
}

/** Fail-closed, mirrors `FedosConversationSearchIndex`'s own `#isPermitted()` (Alpha 2581-2620) exactly: only an explicit `{ outcome: "allowed" }` passes; a thrown error from an unavailable Authority is treated as not-permitted, never as "no gate configured". */
function isPayloadPermitted(retentionAuthority: Pick<FedosPayloadRetentionAuthority, "evaluatePayloadAccess">, payloadId: Parameters<FedosPayloadRetentionAuthority["evaluatePayloadAccess"]>[0]): boolean {
  try {
    return retentionAuthority.evaluatePayloadAccess(payloadId).outcome === "allowed";
  } catch {
    return false;
  }
}

/**
 * Collects every already-persisted record for `conversationId` into one
 * plaintext `FedosConversationArchiveBundleV1`. `null` if the
 * conversation itself is not found. Never throws — a missing/unreadable
 * payload for a listed descriptor (should not happen under this
 * codebase's own append-only-write discipline, but is not assumed
 * impossible) is simply skipped rather than aborting the whole
 * collection, since a partial Archive is still more useful than none
 * and Restore's own per-record validation independently guards every
 * record it is ever handed regardless of how it was collected.
 */
export function collectFedosConversationArchiveBundle(
  conversationId: FedosConversationId,
  deps: FedosConversationArchiveCollectorDependencies,
  exportedAt: number,
): FedosConversationArchiveBundleV1 | null {
  const conversation = deps.conversationPersistence.getConversation(conversationId);
  if (conversation === null) return null;

  const memberships = deps.membershipPersistence.listConversationMemberships(conversationId);
  const capabilityEvents = deps.capabilityPersistence.listConversationCapabilityEvents(conversationId);
  // Secure Runtime Alpha 7481-7560 -- Envelope collection is now gated by
  // the SAME `retentionAuthority`, keyed off each Envelope's own
  // `payloadId` -- an Envelope whose linked Payload is denied is excluded
  // from the bundle exactly like a denied Payload already is, never a
  // placeholder/tombstone record (this Arc's own chosen model, see
  // `docs/secure_runtime_alpha_7481_7560_chosen_archive_model.md`).
  // Membership/Conversation/Capability collection remain intentionally
  // UNLINKED -- those are Conversation-level facts, not per-message ones.
  const envelopes = deps.envelopePersistence
    .listConversationEnvelopes(conversationId)
    .filter((envelope) => deps.retentionAuthority === undefined || isPayloadPermitted(deps.retentionAuthority, envelope.payloadId as Parameters<FedosPayloadRetentionAuthority["evaluatePayloadAccess"]>[0]));

  const payloadDescriptors = deps.payloadStorage.listConversationPayloads(conversationId);
  const payloads = payloadDescriptors
    .filter((descriptor) => deps.retentionAuthority === undefined || isPayloadPermitted(deps.retentionAuthority, descriptor.id))
    .map((descriptor) => deps.payloadStorage.getPayload(descriptor.id))
    .filter((payload): payload is NonNullable<typeof payload> => payload !== null)
    .map((payload) => serializeFedosConversationPayload(payload));

  // Secure Runtime Alpha 1921-1980 -- populated ONLY when this conversation id genuinely has AT
  // LEAST ONE Group Generation recorded (`currentGenerationForGroup() !== null`) AND the caller
  // supplied the Group ports (`deps.group`). A plain Direct conversationId (or a caller who omitted
  // `deps.group` entirely) produces the IDENTICAL Direct-only bundle this codebase has always
  // produced -- see this file's own header.
  //
  // NOT keyed off `conversation.mode` (unlike the Phase A/B design record's own original
  // assumption): re-verifying against real source (`fedos_conversation_active_lookup.ts`,
  // `fedos_group_generation_authority.ts`) shows a REAL `private-group`/`direct` Conversation is
  // NEVER written into `FedosConversationPersistence` at all in this codebase -- that port and its
  // `FedosPersistedConversationRecordV1` wire shape exist ONLY for PUBLIC, Board-thread-anchored
  // Conversations (`validateFedosConversationRecord`, Alpha 748, hard-rejects any `mode` other than
  // `"public"`). A private Conversation's own "is this active" fact lives entirely in
  // `FedosConversationDraftPersistence` + `FedosConversationActivationPersistence`, a completely
  // different persistence domain the pre-existing Direct Archive Foundation (Alpha 1541-1610) never
  // reused for its own `conversation` bundle field either -- a PRE-EXISTING gap this Arc does not
  // introduce and, per this Arc's own "extend don't redesign, never broaden scope" rule, does not
  // widen into a redesign of Alpha 748's own frozen Public-only validator. Detecting "is this a
  // Group" via the REAL, authoritative Group Generation persistence instead of the mismatched
  // `conversation.mode` field keeps the Group Section's own population correct and independent of
  // that pre-existing gap.
  const group =
    deps.group !== undefined && deps.group.groupGenerationPersistence.currentGenerationForGroup(conversationId) !== null
      ? collectFedosConversationArchiveGroupSection(conversationId, { ...deps, group: deps.group }, exportedAt)
      : undefined;

  return {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId,
    exportedAt,
    conversation,
    memberships,
    capabilityEvents,
    envelopes,
    payloads,
    ...(group !== undefined ? { group } : {}),
  };
}

/**
 * Secure Runtime Alpha 1921–1980 — the Group Collector: gathers EVERY
 * Generation (`listGenerations()`), every CURRENT Path fact across each
 * one (`listPathsForGeneration()`), the CURRENT record per Group Message
 * id (`listMessagesForGroup()`), and the CURRENT record per (message,
 * recipient) Fanout Delivery fact (`listDeliveriesForMessage()`) — see
 * the Phase A/B domain inventory (`docs/secure_runtime_alpha_1921_1980_phase_a_domain_inventory.md`
 * §1/§2) for the full canonical-vs-derivable reasoning this function
 * follows verbatim.
 *
 * ALSO walks every distinct `directConversationId` referenced by those
 * Path facts and collects that CHILD Direct Conversation's own full
 * bundle via `collectFedosConversationArchiveBundle()` itself — new
 * ORCHESTRATION on top of the existing Collector, never a new record
 * shape (Phase A's own "Group Container: already archived... Collector
 * must be extended to additionally walk every Group Path's own
 * `directConversationId`" finding). Deduplicated by conversation id
 * (defensive — a child id colliding with `groupConversationId` itself,
 * or appearing via two different paths, is never double-included) and
 * NEVER recurses into a second Group Section: a genuine Direct child's
 * own `mode` is never `"private-group"`, so `collectFedosConversationArchiveBundle()`'s
 * own group-population guard above naturally terminates the recursion.
 */
function collectFedosConversationArchiveGroupSection(
  groupConversationId: FedosConversationId,
  deps: FedosConversationArchiveCollectorDependencies & { readonly group: FedosConversationArchiveGroupCollectorDependencies },
  exportedAt: number,
): FedosConversationArchiveGroupSectionV1 {
  const generations = deps.group.groupGenerationPersistence.listGenerations(groupConversationId);

  const paths: FedosGroupDirectPathRecord[] = [];
  const childConversationIds = new Set<string>();
  for (const generation of generations) {
    for (const path of deps.group.groupDirectPathPersistence.listPathsForGeneration(groupConversationId, generation.generationId)) {
      paths.push(path);
      childConversationIds.add(path.directConversationId);
    }
  }
  // Defensive dedup (Phase C's own explicit instruction): the Group's own conversation id is never
  // itself a "child" -- not reachable in practice (a Path's directConversationId always resolves to
  // a distinct pairwise Direct Conversation via toFedosGroupPairKey()), but guarded regardless.
  childConversationIds.delete(groupConversationId);

  const messages = deps.group.groupMessagePersistence.listMessagesForGroup(groupConversationId);
  const fanoutDeliveries: FedosGroupFanoutDeliveryRecord[] = [];
  for (const message of messages) {
    for (const delivery of deps.group.groupFanoutDeliveryPersistence.listDeliveriesForMessage(message.id)) {
      fanoutDeliveries.push(delivery);
    }
  }

  const childConversations: FedosConversationArchiveBundleV1[] = [];
  for (const childId of childConversationIds) {
    const childBundle = collectFedosConversationArchiveBundle(childId as FedosConversationId, deps, exportedAt);
    if (childBundle !== null) childConversations.push(childBundle);
  }

  return { generations, paths, messages, fanoutDeliveries, childConversations };
}
