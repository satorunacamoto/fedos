/**
 * Secure Runtime Alpha 803 ("Payload Descriptor") — Stage 13 of the
 * Alpha 791–820 Conversation Retention & Private Payload Storage
 * Boundary Foundation Arc.
 *
 * The ONLY place in this repository that constructs a
 * `FedosConversationPayloadDescriptor` — mirrors
 * `validateFedosConversationRecord`'s own "typed builder, sole
 * constructor, fail-closed to `null`, never throws" discipline
 * (`../fedos_conversation_record_validator.ts`, Alpha 748).
 *
 * Enforces, in order: exact field set; well-formed `id`; a non-empty
 * `conversationId` (this boundary does not re-validate the exact shape
 * `FedosConversationId` itself already enforces at construction — Alpha
 * 743's own module is the sole authority for that, this Arc's own
 * "architecture-frozen, do not redesign accepted layers" rule means no
 * new export is added there for this file to call); `mediaType ===
 * "application/octet-stream"` (Alpha 803's own closed vocabulary);
 * `byteLength` a non-negative integer; `createdAt` Unix seconds,
 * reusing `FedosBoardPost`'s own already-decided accepted range rather
 * than inventing a second timestamp policy (matches
 * `validateFedosConversationRecord`'s own identical reuse).
 */

import {
  FEDOS_BOARD_POST_MAX_CREATED_AT,
  FEDOS_BOARD_POST_MIN_CREATED_AT,
} from "../../../../board/fedos_board_post_validator.js";
import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import { toFedosConversationPayloadId } from "../../../../conversation/payload_storage/fedos_conversation_payload_id.js";
import type { FedosConversationPayloadDescriptor } from "../../../../conversation/payload_storage/fedos_conversation_payload_descriptor.js";

/** The typed candidate a caller builds before calling `validateFedosConversationPayloadDescriptor`. */
export interface FedosConversationPayloadDescriptorInput {
  readonly id: string;
  readonly conversationId: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly createdAt: number;
}

const EXPECTED_KEYS: readonly string[] = ["byteLength", "conversationId", "createdAt", "id", "mediaType"].sort();

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidByteLength(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isValidCreatedAt(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= FEDOS_BOARD_POST_MIN_CREATED_AT &&
    value <= FEDOS_BOARD_POST_MAX_CREATED_AT
  );
}

export function validateFedosConversationPayloadDescriptor(
  input: FedosConversationPayloadDescriptorInput,
): FedosConversationPayloadDescriptor | null {
  if (input === null || typeof input !== "object") return null;

  const keys = Object.keys(input).sort();
  if (keys.length !== EXPECTED_KEYS.length || !keys.every((key, index) => key === EXPECTED_KEYS[index])) {
    return null;
  }

  if (!isNonEmptyString(input.id)) return null;
  const id = toFedosConversationPayloadId(input.id);
  if (id === null) return null;

  if (!isNonEmptyString(input.conversationId)) return null;
  const conversationId = input.conversationId as FedosConversationId;

  if (input.mediaType !== "application/octet-stream") return null;
  if (!isValidByteLength(input.byteLength)) return null;
  if (!isValidCreatedAt(input.createdAt)) return null;

  return Object.freeze({
    id,
    conversationId,
    mediaType: "application/octet-stream" as const,
    byteLength: input.byteLength,
    createdAt: input.createdAt,
  });
}
