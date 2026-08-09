/**
 * Secure Runtime Alpha 806 ("Payload Codec V1") — Stage 16 of the Alpha
 * 791–820 Conversation Retention & Private Payload Storage Boundary
 * Foundation Arc.
 *
 * The ONLY two functions permitted to convert between the runtime
 * `FedosConversationPayload` (descriptor + real `Uint8Array` bytes) and
 * the persisted wire shape `FedosPersistedConversationPayloadV1`
 * (base64 bytes) — mirrors `serializeFedosConversationRecord`/
 * `deserializeFedosConversationRecord`'s own exact discipline (Alpha
 * 750).
 *
 * HARD GUARDRAILS:
 *   - `deserializeFedosConversationPayload` fails closed: `null` for
 *     anything malformed, never throws.
 *   - `schemaVersion` checked EXACTLY against `1`.
 *   - Unknown top-level fields are REJECTED.
 *   - Invalid base64 is REJECTED, not silently truncated/repaired —
 *     Node's own `Buffer.from(str, "base64")` is lenient (silently
 *     drops invalid characters rather than throwing), so this file
 *     independently validates the base64 ALPHABET/PADDING shape via
 *     regex before ever decoding, and independently cross-checks the
 *     decoded byte length against the record's own `byteLength` field
 *     — either check failing rejects the whole record.
 *   - `deserializeFedosConversationPayload` reuses
 *     `validateFedosConversationPayloadDescriptor` (Alpha 803,
 *     unmodified) for every descriptor-shaped check rather than
 *     re-implementing any of them.
 *   - No logging of bytes, no `console.log`/`JSON.stringify` of raw
 *     byte content anywhere in this file (Alpha 805).
 */

// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";
import {
  validateFedosConversationPayloadDescriptor,
  type FedosConversationPayloadDescriptorInput,
} from "../../../../conversation/payload_storage/fedos_conversation_payload_descriptor_validator.js";
import type { FedosConversationPayload } from "../../../../conversation/payload_storage/fedos_conversation_payload_storage.js";
import type { FedosPersistedConversationPayloadV1 } from "../../../../conversation/payload_storage/fedos_persisted_conversation_payload_v1.js";

/** Deep-copies `payload` into the persisted V1 wire shape, base64-encoding `bytes` for this persistence boundary only. */
export function serializeFedosConversationPayload(payload: FedosConversationPayload): FedosPersistedConversationPayloadV1 {
  return {
    schemaVersion: 1,
    id: payload.descriptor.id,
    conversationId: payload.descriptor.conversationId,
    mediaType: payload.descriptor.mediaType,
    byteLength: payload.descriptor.byteLength,
    createdAt: payload.descriptor.createdAt,
    bytesBase64: Buffer.from(payload.bytes).toString("base64"),
  };
}

const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "id",
  "conversationId",
  "mediaType",
  "byteLength",
  "createdAt",
  "bytesBase64",
]);

/** Strict base64 alphabet/padding shape check — Buffer.from(str, "base64") alone does not validate this. */
const BASE64_SHAPE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

interface RawTopLevelFields {
  readonly schemaVersion: unknown;
  readonly id: unknown;
  readonly conversationId: unknown;
  readonly mediaType: unknown;
  readonly byteLength: unknown;
  readonly createdAt: unknown;
  readonly bytesBase64: unknown;
}

/** Fails closed to `null` for any malformed, unrecognized-schema, corrupt, or invalid-base64 input. Never throws. */
export function deserializeFedosConversationPayload(record: unknown): FedosConversationPayload | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => TOP_LEVEL_KEYS.has(key)) || keys.length !== TOP_LEVEL_KEYS.size) return null;

  const { schemaVersion, id, conversationId, mediaType, byteLength, createdAt, bytesBase64 } =
    record as RawTopLevelFields;

  if (schemaVersion !== 1) return null;
  if (typeof id !== "string") return null;
  if (typeof conversationId !== "string") return null;
  if (typeof mediaType !== "string") return null;
  if (typeof byteLength !== "number") return null;
  if (typeof createdAt !== "number") return null;
  if (typeof bytesBase64 !== "string") return null;

  // Empty string is valid base64 for zero bytes; anything else must match the strict shape.
  if (bytesBase64.length > 0 && !BASE64_SHAPE.test(bytesBase64)) return null;

  const descriptorInput: FedosConversationPayloadDescriptorInput = {
    id,
    conversationId,
    mediaType,
    byteLength,
    createdAt,
  };
  const descriptor = validateFedosConversationPayloadDescriptor(descriptorInput);
  if (descriptor === null) return null;

  // A fresh Uint8Array, not a reference into Buffer's own pooled memory --
  // Object.freeze() on a TypedArray does not actually prevent index
  // mutation (a documented JS TypedArray exemption), so the real
  // defense here is that this is always a NEWLY allocated copy, never
  // shared with anything else.
  const bytes = Uint8Array.from(Buffer.from(bytesBase64, "base64"));
  if (bytes.length !== descriptor.byteLength) return null;

  return Object.freeze({ descriptor, bytes });
}
