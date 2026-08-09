/**
 * Secure Runtime Alpha 858 ("Envelope Codec") — Stage 8 of Phase A of
 * the Alpha 851–890 Private Message Envelope and Encryption Authority
 * Activation Arc.
 *
 * The ONLY two functions permitted to convert between the runtime
 * `FedosConversationMessageEnvelope` (Alpha 854) and the persisted wire
 * shape `FedosPersistedConversationMessageEnvelopeV1`
 * (`./fedos_persisted_conversation_message_envelope_v1.ts`) — mirrors
 * `serializeFedosConversationMembership`/`deserializeFedosConversationMembership`'s
 * own exact discipline (Alpha 826).
 *
 * HARD GUARDRAILS:
 *   - `deserializeFedosConversationMessageEnvelope` fails closed: `null`
 *     for anything malformed, never throws.
 *   - `schemaVersion` checked EXACTLY against `1` — no silent migration.
 *   - Unknown top-level fields are REJECTED.
 *   - Reuses `validateFedosConversationMessageEnvelope` (Alpha 855)
 *     rather than re-implementing any check.
 *   - Round-trip equality: `deserialize(serialize(e))` equals `e`
 *     field-for-field.
 */

import {
  validateFedosConversationMessageEnvelope,
  type FedosConversationMessageEnvelopeInput,
} from "../../../../../conversation/envelope/fedos_conversation_message_envelope_validator.js";
import type { FedosConversationMessageEnvelope } from "../../../../../conversation/envelope/fedos_conversation_message_envelope.js";
import type { FedosPersistedConversationMessageEnvelopeV1 } from "../../../../../conversation/envelope/persistence/fedos_persisted_conversation_message_envelope_v1.js";

/** Deep-copies `envelope` into the persisted V1 wire shape. */
export function serializeFedosConversationMessageEnvelope(
  envelope: FedosConversationMessageEnvelope,
): FedosPersistedConversationMessageEnvelopeV1 {
  return {
    schemaVersion: 1,
    id: envelope.id,
    conversationId: envelope.conversationId,
    senderMembershipId: envelope.senderMembershipId,
    payloadId: envelope.payloadId,
    encryptionSuite: envelope.encryptionSuite,
    keyEpoch: envelope.keyEpoch,
    createdAt: envelope.createdAt,
    replyToEnvelopeId: envelope.replyToEnvelopeId,
  };
}

const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "id",
  "conversationId",
  "senderMembershipId",
  "payloadId",
  "encryptionSuite",
  "keyEpoch",
  "createdAt",
  "replyToEnvelopeId",
]);

interface RawTopLevelFields {
  readonly schemaVersion: unknown;
  readonly id: unknown;
  readonly conversationId: unknown;
  readonly senderMembershipId: unknown;
  readonly payloadId: unknown;
  readonly encryptionSuite: unknown;
  readonly keyEpoch: unknown;
  readonly createdAt: unknown;
  readonly replyToEnvelopeId: unknown;
}

/** Fails closed to `null` for any malformed, unrecognized-schema, or corrupt input. */
export function deserializeFedosConversationMessageEnvelope(record: unknown): FedosConversationMessageEnvelope | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => TOP_LEVEL_KEYS.has(key))) return null;

  const {
    schemaVersion,
    id,
    conversationId,
    senderMembershipId,
    payloadId,
    encryptionSuite,
    keyEpoch,
    createdAt,
    replyToEnvelopeId,
  } = record as RawTopLevelFields;

  if (schemaVersion !== 1) return null;
  if (typeof id !== "string") return null;
  if (typeof conversationId !== "string") return null;
  if (typeof senderMembershipId !== "string") return null;
  if (typeof payloadId !== "string") return null;
  if (typeof encryptionSuite !== "string") return null;
  if (typeof keyEpoch !== "number") return null;
  if (typeof createdAt !== "number") return null;
  if (replyToEnvelopeId !== null && typeof replyToEnvelopeId !== "string") return null;

  const input: FedosConversationMessageEnvelopeInput = {
    id,
    conversationId,
    senderMembershipId,
    payloadId,
    encryptionSuite,
    keyEpoch,
    createdAt,
    replyToEnvelopeId,
  };

  return validateFedosConversationMessageEnvelope(input);
}
