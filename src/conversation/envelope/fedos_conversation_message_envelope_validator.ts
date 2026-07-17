/**
 * Secure Runtime Alpha 855 ("Envelope Validation") — Stage 5 of Phase A
 * of the Alpha 851–890 Private Message Envelope and Encryption Authority
 * Activation Arc.
 *
 * The ONLY place in this repository that constructs a
 * `FedosConversationMessageEnvelope` — mirrors
 * `validateFedosConversationMembership`'s own "typed builder, sole
 * constructor, fail-closed to `null`, never throws" discipline
 * (`../membership/fedos_conversation_membership_validator.ts`, Alpha
 * 826).
 *
 * HARD GUARDRAILS:
 *   - Exact field set; unknown/extra field rejected.
 *   - `id`/`conversationId`/`senderMembershipId`/`payloadId` are
 *     non-empty, path-character-free strings — this boundary does not
 *     re-validate the exact shape each id's own module already enforces
 *     at construction (this Arc's own "architecture-frozen" rule: no new
 *     export is added to any of those modules for this file to call).
 *   - `encryptionSuite` checked against the closed
 *     `FEDOS_CONVERSATION_ENVELOPE_ENCRYPTION_SUITES` vocabulary.
 *   - `keyEpoch` a non-negative integer.
 *   - `createdAt` Unix seconds, reusing `FedosBoardPost`'s own already-
 *     decided accepted range (matches every other Conversation-domain
 *     validator's identical reuse).
 *   - `replyToEnvelopeId` — `null`, or a well-formed
 *     `FedosConversationEnvelopeId` DIFFERENT from `id` itself (a
 *     self-reply is a structural contradiction Alpha 855 explicitly
 *     names, "no self-reply contradiction").
 *   - Malformed input returns `null`, never throws.
 *   - No network/storage mutation of any kind — pure construction only.
 *   - Deep-copies nothing beyond what plain string/number fields already
 *     are, and `Object.freeze`s the result.
 */

import { FEDOS_BOARD_POST_MAX_CREATED_AT, FEDOS_BOARD_POST_MIN_CREATED_AT } from "../../board/fedos_board_post_validator.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import { toFedosConversationEnvelopeId } from "./fedos_conversation_envelope_id.js";
import type { FedosConversationMembershipId } from "../membership/fedos_conversation_membership_id.js";
import { toFedosConversationPayloadId } from "../payload_storage/fedos_conversation_payload_id.js";
import {
  FEDOS_CONVERSATION_ENVELOPE_ENCRYPTION_SUITES,
  type FedosConversationEnvelopeEncryptionSuite,
  type FedosConversationMessageEnvelope,
} from "./fedos_conversation_message_envelope.js";

export interface FedosConversationMessageEnvelopeInput {
  readonly id: string;
  readonly conversationId: string;
  readonly senderMembershipId: string;
  readonly payloadId: string;
  readonly encryptionSuite: string;
  readonly keyEpoch: number;
  readonly createdAt: number;
  readonly replyToEnvelopeId: string | null;
}

const EXPECTED_KEYS: readonly string[] = [
  "conversationId",
  "createdAt",
  "encryptionSuite",
  "id",
  "keyEpoch",
  "payloadId",
  "replyToEnvelopeId",
  "senderMembershipId",
]
  .slice()
  .sort();

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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

function isValidKeyEpoch(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Validates and constructs a `FedosConversationMessageEnvelope`. See this file's own header for the full check list. */
export function validateFedosConversationMessageEnvelope(candidate: unknown): FedosConversationMessageEnvelope | null {
  if (candidate === null || typeof candidate !== "object") return null;

  const keys = Object.keys(candidate).sort();
  if (keys.length !== EXPECTED_KEYS.length || !keys.every((key, index) => key === EXPECTED_KEYS[index])) {
    return null;
  }

  const value = candidate as Record<string, unknown>;

  if (!isNonEmptyString(value.id)) return null;
  const id = toFedosConversationEnvelopeId(value.id);
  if (id === null) return null;

  if (!isNonEmptyString(value.conversationId)) return null;
  const conversationId = value.conversationId as FedosConversationId;

  if (!isNonEmptyString(value.senderMembershipId)) return null;
  const senderMembershipId = value.senderMembershipId as FedosConversationMembershipId;

  if (!isNonEmptyString(value.payloadId)) return null;
  const payloadId = toFedosConversationPayloadId(value.payloadId);
  if (payloadId === null) return null;

  if (
    typeof value.encryptionSuite !== "string" ||
    !FEDOS_CONVERSATION_ENVELOPE_ENCRYPTION_SUITES.includes(value.encryptionSuite as FedosConversationEnvelopeEncryptionSuite)
  ) {
    return null;
  }
  const encryptionSuite = value.encryptionSuite as FedosConversationEnvelopeEncryptionSuite;

  if (!isValidKeyEpoch(value.keyEpoch)) return null;
  const keyEpoch = value.keyEpoch as number;

  if (!isValidCreatedAt(value.createdAt)) return null;
  const createdAt = value.createdAt as number;

  let replyToEnvelopeId: ReturnType<typeof toFedosConversationEnvelopeId> = null;
  if (value.replyToEnvelopeId !== null) {
    if (!isNonEmptyString(value.replyToEnvelopeId)) return null;
    replyToEnvelopeId = toFedosConversationEnvelopeId(value.replyToEnvelopeId);
    if (replyToEnvelopeId === null) return null;
    // No self-reply contradiction (Alpha 855's own explicit requirement).
    if (replyToEnvelopeId === id) return null;
  }

  return Object.freeze({
    id,
    conversationId,
    senderMembershipId,
    payloadId,
    encryptionSuite,
    keyEpoch,
    createdAt,
    replyToEnvelopeId,
  });
}
