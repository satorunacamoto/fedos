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
import type { FedosConversationArchiveBundleV1 } from "./fedos_conversation_archive_bundle.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "./fedos_conversation_archive_schema_version.js";

export interface FedosConversationArchiveCollectorDependencies {
  readonly conversationPersistence: FedosConversationPersistence;
  readonly membershipPersistence: FedosConversationMembershipPersistence;
  readonly capabilityPersistence: FedosConversationCapabilityPersistence;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
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
  const envelopes = deps.envelopePersistence.listConversationEnvelopes(conversationId);

  const payloadDescriptors = deps.payloadStorage.listConversationPayloads(conversationId);
  const payloads = payloadDescriptors
    .map((descriptor) => deps.payloadStorage.getPayload(descriptor.id))
    .filter((payload): payload is NonNullable<typeof payload> => payload !== null)
    .map((payload) => serializeFedosConversationPayload(payload));

  return {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId,
    exportedAt,
    conversation,
    memberships,
    capabilityEvents,
    envelopes,
    payloads,
  };
}
