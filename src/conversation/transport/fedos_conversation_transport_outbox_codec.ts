/**
 * Secure Runtime Alpha 1471–1540 — the persisted wire shape for
 * `FedosConversationTransportOutboxIntent`. Mirrors
 * `FedosPersistedBoardOutboxRecordV1`/`serializeFedosBoardOutboxIntent`/
 * `deserializeFedosBoardOutboxIntent`
 * (`../../board/outbox/fedos_board_outbox_codec.ts`, Alpha 416) exactly —
 * same fail-closed discipline, same "re-derive the id, reject on
 * mismatch" defense against a tampered/hand-edited log line.
 *
 * HARD GUARDRAILS:
 *   - `deserializeFedosConversationTransportOutboxIntent` never throws.
 *   - `schemaVersion` checked EXACTLY against `1`; unknown top-level
 *     fields REJECTED.
 *
 * Secure Runtime Alpha 1841–1920 ("NIP-17 Standard Transport Integration
 * and Group Pairwise Delivery Arc") Phase B (Alpha 1846/1848) — ADDITIVE
 * `schemaVersion: 2` record. V1 is untouched, byte-for-byte (same fields,
 * same validation, same functions) — every existing `fedos-private-v1`
 * caller/test continues to see EXACTLY the V1 shape it always has. V2
 * exists for the standard `nostr-nip17-v1` route ONLY: it carries the
 * ALREADY-SIGNED native Gift Wrap event (`FedosPreparedPrivateDelivery`,
 * `fedos_private_wire_prepared_delivery.ts`) verbatim, because that route
 * cannot be lazily re-derived from `envelopeId` alone at publish/retry
 * time the way V1's proprietary ciphertext can (see that file's own
 * "Retry Stability" Option A discussion) — NO plaintext, NO raw key,
 * ever, in a V2 record.
 */

import {
  createFedosConversationTransportOutboxIntent,
  type FedosConversationTransportOutboxIntent,
} from "./fedos_conversation_transport_outbox_types.js";
import { toFedosConversationEnvelopeId } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosNostrWireEvent } from "../../desktop/fedos_nostr_wire_event.js";

export interface FedosPersistedConversationTransportOutboxRecordV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly envelopeId: string;
  readonly conversationId: string;
  readonly createdAt: number;
}

/** Alpha 1846/1848 — the ADDITIVE standard-route record. See this file's own header. */
export interface FedosPersistedConversationTransportOutboxRecordV2 {
  readonly schemaVersion: 2;
  readonly id: string;
  readonly envelopeId: string;
  readonly conversationId: string;
  readonly createdAt: number;
  readonly route: "nostr-nip17-v1";
  readonly recipientPublicKeyHex: string;
  readonly nativeEvent: FedosNostrWireEvent;
}

/** The one closed union every generic Outbox call site (persistence/scheduler/publisher) now handles. */
export type FedosPersistedConversationTransportOutboxRecord =
  | FedosPersistedConversationTransportOutboxRecordV1
  | FedosPersistedConversationTransportOutboxRecordV2;

export function serializeFedosConversationTransportOutboxIntent(
  intent: FedosConversationTransportOutboxIntent,
): FedosPersistedConversationTransportOutboxRecordV1 {
  return {
    schemaVersion: 1,
    id: intent.id,
    envelopeId: intent.envelopeId,
    conversationId: intent.conversationId,
    createdAt: intent.createdAt,
  };
}

const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set(["schemaVersion", "id", "envelopeId", "conversationId", "createdAt"]);

interface RawTopLevelFields {
  readonly schemaVersion: unknown;
  readonly id: unknown;
  readonly envelopeId: unknown;
  readonly conversationId: unknown;
  readonly createdAt: unknown;
}

/** Fails closed to `null` for any malformed, unrecognized-schema, or corrupt input. Never throws. */
export function deserializeFedosConversationTransportOutboxIntent(
  record: unknown,
): FedosConversationTransportOutboxIntent | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => TOP_LEVEL_KEYS.has(key)) || keys.length !== TOP_LEVEL_KEYS.size) return null;

  const { schemaVersion, id, envelopeId, conversationId, createdAt } = record as RawTopLevelFields;

  if (schemaVersion !== 1) return null;
  if (typeof id !== "string") return null;
  if (typeof envelopeId !== "string") return null;
  if (typeof conversationId !== "string") return null;
  if (typeof createdAt !== "number") return null;

  const brandedEnvelopeId = toFedosConversationEnvelopeId(envelopeId);
  if (brandedEnvelopeId === null) return null;

  // FedosConversationId has no independent "brand an already-formed
  // string" validator (only toFedosConversationId(boardId, threadId),
  // which derives one from parts) -- the persisted string already
  // carries the derived, `::`-joined form, so it is re-branded via a
  // direct cast, the SAME pattern
  // `deserializeFedosConversationMessageEnvelope`
  // (`../envelope/persistence/fedos_conversation_message_envelope_codec.ts`,
  // Alpha 858) already uses for this identical field.
  const intent = createFedosConversationTransportOutboxIntent(
    brandedEnvelopeId,
    conversationId as unknown as FedosConversationId,
    createdAt,
  );
  if (intent === null) return null;
  if (intent.id !== id) return null;

  return intent;
}

// ---------------------------------------------------------------------
// Secure Runtime Alpha 1841–1920 Phase B (Alpha 1846/1848) — ADDITIVE
// V2 (standard route) codec below. Nothing above this line is touched.
// ---------------------------------------------------------------------

/** Builds the persisted V2 record for a `FedosPreparedPrivateDelivery` — the caller's own `envelopeId`/`conversationId` identity, plus the already-signed native event verbatim. */
export function serializeFedosConversationTransportOutboxRecordV2(input: {
  readonly envelopeId: string;
  readonly conversationId: string;
  readonly createdAt: number;
  readonly recipientPublicKeyHex: string;
  readonly nativeEvent: FedosNostrWireEvent;
}): FedosPersistedConversationTransportOutboxRecordV2 {
  return {
    schemaVersion: 2,
    id: input.envelopeId,
    envelopeId: input.envelopeId,
    conversationId: input.conversationId,
    createdAt: input.createdAt,
    route: "nostr-nip17-v1",
    recipientPublicKeyHex: input.recipientPublicKeyHex,
    nativeEvent: input.nativeEvent,
  };
}

const V2_TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "id",
  "envelopeId",
  "conversationId",
  "createdAt",
  "route",
  "recipientPublicKeyHex",
  "nativeEvent",
]);
const NATIVE_EVENT_KEYS: ReadonlySet<string> = new Set(["id", "pubkey", "created_at", "kind", "tags", "content", "sig"]);

function isWellFormedNativeEvent(value: unknown): value is FedosNostrWireEvent {
  if (value === null || typeof value !== "object") return false;
  const keys = Object.keys(value);
  if (!keys.every((key) => NATIVE_EVENT_KEYS.has(key)) || keys.length !== NATIVE_EVENT_KEYS.size) return false;
  const event = value as Record<string, unknown>;
  if (typeof event.id !== "string" || event.id.length === 0) return false;
  if (typeof event.pubkey !== "string" || event.pubkey.length === 0) return false;
  if (typeof event.created_at !== "number" || !Number.isFinite(event.created_at)) return false;
  if (typeof event.kind !== "number" || !Number.isInteger(event.kind)) return false;
  if (!Array.isArray(event.tags) || !event.tags.every((tag) => Array.isArray(tag) && tag.every((t) => typeof t === "string"))) {
    return false;
  }
  if (typeof event.content !== "string") return false;
  if (typeof event.sig !== "string" || event.sig.length === 0) return false;
  return true;
}

/** Fails closed to `null` for any malformed, unrecognized-schema, or corrupt input. Never throws. */
export function deserializeFedosConversationTransportOutboxRecordV2(
  record: unknown,
): FedosPersistedConversationTransportOutboxRecordV2 | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => V2_TOP_LEVEL_KEYS.has(key)) || keys.length !== V2_TOP_LEVEL_KEYS.size) return null;

  const value = record as Record<string, unknown>;
  if (value.schemaVersion !== 2) return null;
  if (typeof value.id !== "string" || value.id.length === 0) return null;
  if (typeof value.envelopeId !== "string" || value.envelopeId.length === 0) return null;
  if (typeof value.conversationId !== "string" || value.conversationId.length === 0) return null;
  if (typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt)) return null;
  if (value.route !== "nostr-nip17-v1") return null;
  if (typeof value.recipientPublicKeyHex !== "string" || value.recipientPublicKeyHex.length === 0) return null;
  if (value.id !== value.envelopeId) return null;
  if (!isWellFormedNativeEvent(value.nativeEvent)) return null;

  return Object.freeze({
    schemaVersion: 2,
    id: value.id,
    envelopeId: value.envelopeId,
    conversationId: value.conversationId,
    createdAt: value.createdAt,
    route: "nostr-nip17-v1",
    recipientPublicKeyHex: value.recipientPublicKeyHex,
    nativeEvent: value.nativeEvent as FedosNostrWireEvent,
  });
}

/** The one generic dispatcher every widened persistence backend uses — dispatches on `schemaVersion`, fails closed to `null` for anything else. Never throws. */
export function deserializeFedosConversationTransportOutboxRecord(
  record: unknown,
): FedosPersistedConversationTransportOutboxRecord | null {
  if (record === null || typeof record !== "object") return null;
  const schemaVersion = (record as { schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion === 2) return deserializeFedosConversationTransportOutboxRecordV2(record);
  if (schemaVersion === 1) {
    const intent = deserializeFedosConversationTransportOutboxIntent(record);
    return intent === null ? null : (record as FedosPersistedConversationTransportOutboxRecordV1);
  }
  return null;
}
