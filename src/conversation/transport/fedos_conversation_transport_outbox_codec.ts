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
 */

import {
  createFedosConversationTransportOutboxIntent,
  type FedosConversationTransportOutboxIntent,
} from "./fedos_conversation_transport_outbox_types.js";
import { toFedosConversationEnvelopeId } from "../envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";

export interface FedosPersistedConversationTransportOutboxRecordV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly envelopeId: string;
  readonly conversationId: string;
  readonly createdAt: number;
}

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
