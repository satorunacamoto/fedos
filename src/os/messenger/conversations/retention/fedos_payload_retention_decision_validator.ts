/**
 * Secure Runtime Alpha 795 ("Retention Decision Record") — Stage 5 of
 * the Alpha 791–820 Conversation Retention & Private Payload Storage
 * Boundary Foundation Arc.
 *
 * The ONLY place in this repository that constructs a
 * `FedosPayloadRetentionDecision` — mirrors
 * `validateFedosConversationRecord`'s own "typed builder, sole
 * constructor, fail-closed to `null`, never throws" discipline (Alpha
 * 748).
 */

import {
  FEDOS_BOARD_POST_MAX_CREATED_AT,
  FEDOS_BOARD_POST_MIN_CREATED_AT,
} from "../../board/fedos_board_post_validator.js";
import { toFedosConversationPayloadId } from "../payload_storage/fedos_conversation_payload_id.js";
import type { FedosPayloadRetentionAction, FedosPayloadRetentionDecision, FedosPayloadRetentionReasonCode } from "./fedos_payload_retention_decision.js";

export interface FedosPayloadRetentionDecisionInput {
  readonly payloadId: string;
  readonly action: string;
  readonly decidedAt: number;
  readonly authorityReference: string | null;
  readonly reasonCode: string;
}

const EXPECTED_KEYS: readonly string[] = ["action", "authorityReference", "decidedAt", "payloadId", "reasonCode"].sort();
const ACTIONS: readonly FedosPayloadRetentionAction[] = ["tombstoned", "payload-removed"];
const REASON_CODES: readonly FedosPayloadRetentionReasonCode[] = [
  "user_requested_placeholder",
  "policy_placeholder",
  "test_placeholder",
];

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

export function validateFedosPayloadRetentionDecision(
  input: FedosPayloadRetentionDecisionInput,
): FedosPayloadRetentionDecision | null {
  if (input === null || typeof input !== "object") return null;

  const keys = Object.keys(input).sort();
  if (keys.length !== EXPECTED_KEYS.length || !keys.every((key, index) => key === EXPECTED_KEYS[index])) {
    return null;
  }

  if (!isNonEmptyString(input.payloadId)) return null;
  const payloadId = toFedosConversationPayloadId(input.payloadId);
  if (payloadId === null) return null;

  if (typeof input.action !== "string" || !(ACTIONS as readonly string[]).includes(input.action)) return null;

  if (!isValidCreatedAt(input.decidedAt)) return null;

  if (input.authorityReference !== null && !isNonEmptyString(input.authorityReference)) return null;

  if (typeof input.reasonCode !== "string" || !(REASON_CODES as readonly string[]).includes(input.reasonCode)) return null;

  return Object.freeze({
    payloadId,
    action: input.action as FedosPayloadRetentionAction,
    decidedAt: input.decidedAt,
    authorityReference: input.authorityReference,
    reasonCode: input.reasonCode as FedosPayloadRetentionReasonCode,
  });
}
