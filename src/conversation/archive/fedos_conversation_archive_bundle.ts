/**
 * Secure Runtime Alpha 1541–1610 ("Conversation Export, Restore, Archive
 * Foundation") — Archive Bundle V1.
 *
 * The full, PLAINTEXT (pre-encryption) contents of one conversation's
 * Archive — a pure AGGREGATE of five already-existing, already-frozen
 * persisted wire shapes, never a new record shape of its own for any of
 * the five reused domains:
 *
 *   - `FedosPersistedConversationRecordV1`   (Conversation Persistence, Alpha 750)
 *   - `FedosPersistedConversationMembershipV1[]` (Membership, Alpha 825 — CURRENT record per id, per `listConversationMemberships()`)
 *   - `FedosPersistedConversationCapabilityEventV1[]` (Capability, Alpha 833/838 — RAW `"issued"`/`"redeemed"` events, per `listConversationCapabilityEvents()`, Alpha 1541–1610)
 *   - `FedosPersistedConversationMessageEnvelopeV1[]` (Envelope, Alpha 858)
 *   - `FedosPersistedConversationPayloadV1[]`  (Payload, Alpha 806 — base64 bytes, the ONLY place this codebase already allows that encoding)
 *
 * Capability uses raw EVENTS (not the reconstructed current-state
 * record `listConversationCapabilities()` returns) because a
 * reconstructed record's `currentUses` is a COUNT only — replaying just
 * that count back into a fresh backend on Restore would lose WHICH
 * distinct redeemers already used a slot, silently permitting a
 * double-redemption after restore. Membership uses the CURRENT record
 * per id (not raw `(id, state)` history) because that port exposes no
 * raw-event listing and the current record alone is sufficient to
 * reconstruct correct present-day membership status on Restore — see
 * `fedos_conversation_archive_collector.ts` for the full reasoning.
 *
 * HARD GUARDRAILS:
 *   - `schemaVersion` is the literal numeric type `1`
 *     (`FedosConversationArchiveSchemaVersion`).
 *   - Every nested record is the EXISTING wire V1 type verbatim — no
 *     field is renamed, flattened, or added here.
 *   - No key material, no bearer secret (Capability events already only
 *     ever carry `bearerVerifier`, never a raw secret — Alpha 834/835,
 *     unchanged).
 *   - This file defines a TYPE ONLY — no function, no class.
 */

import type { FedosConversationArchiveSchemaVersion } from "./fedos_conversation_archive_schema_version.js";
import type { FedosPersistedConversationRecordV1 } from "../persistence/fedos_persisted_conversation_record_v1.js";
import type { FedosPersistedConversationMembershipV1 } from "../membership/persistence/fedos_persisted_conversation_membership_v1.js";
import type { FedosPersistedConversationCapabilityEventV1 } from "../capability/persistence/fedos_persisted_conversation_capability_v1.js";
import type { FedosPersistedConversationMessageEnvelopeV1 } from "../envelope/persistence/fedos_persisted_conversation_message_envelope_v1.js";
import type { FedosPersistedConversationPayloadV1 } from "../payload_storage/fedos_persisted_conversation_payload_v1.js";
import type { FedosConversationArchiveGroupSectionV1 } from "./fedos_conversation_archive_group_section.js";
import type { FedosConversationArchiveSubject } from "./fedos_conversation_archive_direct_subject.js";

export interface FedosConversationArchiveBundleV1 {
  readonly schemaVersion: FedosConversationArchiveSchemaVersion;
  readonly conversationId: string;
  readonly exportedAt: number;
  /**
   * Secure Runtime Alpha 7801-7880 — widened from the bare
   * `FedosPersistedConversationRecordV1` (Board-only) to
   * `FedosConversationArchiveSubject`, additively: a bare object (no
   * `kind` field) is still read as exactly the pre-existing Board shape,
   * byte-for-byte unchanged for every Archive this codebase produced
   * before this Arc; an object with `kind: "direct"` is the new Direct
   * Conversation subject. See `./fedos_conversation_archive_direct_subject.ts`.
   */
  readonly conversation: FedosConversationArchiveSubject;
  readonly memberships: readonly FedosPersistedConversationMembershipV1[];
  readonly capabilityEvents: readonly FedosPersistedConversationCapabilityEventV1[];
  readonly envelopes: readonly FedosPersistedConversationMessageEnvelopeV1[];
  readonly payloads: readonly FedosPersistedConversationPayloadV1[];
  /**
   * Secure Runtime Alpha 1921–1980 — OPTIONAL, additive. Present iff
   * `conversationId` is a `private-group` Conversation AND the Collector
   * was given the Group persistence ports it needs to populate it.
   * Absent, this bundle is a Direct-only bundle, byte-for-byte identical
   * in shape to every Archive this codebase produced before this Arc —
   * see `./fedos_conversation_archive_group_section.ts`'s own header.
   */
  readonly group?: FedosConversationArchiveGroupSectionV1;
}
