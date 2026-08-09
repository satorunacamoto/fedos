/**
 * Secure Runtime Alpha 804 ("Storage Port") — Stage 14 of the Alpha
 * 791–820 Conversation Retention & Private Payload Storage Boundary
 * Foundation Arc.
 *
 * A DEDICATED port for opaque payload bytes — mirrors
 * `FedosConversationPersistence`'s own shape (Alpha 749) but is a
 * DIFFERENT persistence concern: Conversation metadata (mode, root
 * mapping, policy reference) lives in `FedosConversationPersistence`
 * (unchanged, never duplicated here — Alpha 816); this port stores
 * ONLY opaque payload bytes plus their own non-secret descriptor.
 *
 * Retention operations (tombstone/removal) are DELIBERATELY NOT on this
 * port — Alpha 796/811's own instruction: those are owned by
 * `FedosPayloadRetentionAuthority` (`../retention/fedos_payload_retention_authority.ts`),
 * which wraps this port narrowly for gated reads. This port itself has
 * NO delete method of any kind — matching every other append-only-backed
 * port in this codebase (Board/Outbox/Conversation), and this Arc's own
 * Absolute Prohibition on automatic compaction.
 *
 * HARD GUARDRAILS:
 *   - No delete/tombstone/compaction method.
 *   - `getPayload` returns bytes as a DEFENSIVE COPY (Alpha 805) —
 *     never a reference to any internally-held array.
 *   - `listConversationPayloads` returns DESCRIPTORS ONLY — never bulk
 *     bytes; a caller that wants bytes must call `getPayload` per id
 *     (Alpha 813's own Conversation-isolation discipline: a caller must
 *     already know the specific payload id).
 *   - Synchronous, matching `FedosConversationPersistence`'s own
 *     contract.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationPayloadDescriptor } from "./fedos_conversation_payload_descriptor.js";
import type { FedosConversationPayloadId } from "./fedos_conversation_payload_id.js";

/** Mirrors `FedosConversationPersistenceWriteResult` exactly (Alpha 749) — no new outcome invented, no outcome omitted. */
export type FedosConversationPayloadStorageWriteResult = "inserted" | "already-present" | "conflict" | "failed";

/** The full read result — descriptor plus a defensive copy of the bytes. */
export interface FedosConversationPayload {
  readonly descriptor: FedosConversationPayloadDescriptor;
  readonly bytes: Uint8Array;
}

export interface FedosConversationPayloadStorage {
  putPayload(descriptor: FedosConversationPayloadDescriptor, bytes: Uint8Array): FedosConversationPayloadStorageWriteResult;
  getPayload(id: FedosConversationPayloadId): FedosConversationPayload | null;
  getDescriptor(id: FedosConversationPayloadId): FedosConversationPayloadDescriptor | null;
  listConversationPayloads(conversationId: FedosConversationId): readonly FedosConversationPayloadDescriptor[];
}

/** Structural equality over a descriptor's own fields — the SAME role `fedosPersistedConversationRecordsAreEqual` plays for Conversation persistence (Alpha 749). Bytes are compared separately (`bytesAreEqual`, below), since a full descriptor+bytes record equality check needs both. */
export function fedosConversationPayloadDescriptorsAreEqual(
  a: FedosConversationPayloadDescriptor,
  b: FedosConversationPayloadDescriptor,
): boolean {
  return (
    a.id === b.id &&
    a.conversationId === b.conversationId &&
    a.mediaType === b.mediaType &&
    a.byteLength === b.byteLength &&
    a.createdAt === b.createdAt
  );
}

/** Byte-for-byte equality — used alongside `fedosConversationPayloadDescriptorsAreEqual` to decide `"already-present"` vs `"conflict"`. */
export function fedosConversationPayloadBytesAreEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
