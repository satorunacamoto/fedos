/**
 * Secure Runtime Alpha 795 ("Retention Decision Record") — Stage 5 of
 * the Alpha 791–820 Conversation Retention & Private Payload Storage
 * Boundary Foundation Arc.
 *
 * An immutable record of ONE retention transition — never a mutable
 * "current state" field. `FedosPayloadRetentionAction` deliberately
 * excludes `"active"`: active is the implicit absence of any decision
 * (Alpha 794), never a written record of its own (there is nothing to
 * durably record about a payload that has had nothing done to it).
 *
 * `reasonCode` is a CLOSED vocabulary — no free-form reason string
 * (this Arc's own explicit instruction), matching
 * `FedosBoardModerationReasonCode`'s own established discipline
 * (`../../board/fedos_board_moderation.ts`, Alpha 258).
 * `authorityReference` is `string | null` — an opaque, non-secret
 * reference to whoever/whatever decided (or `null` for
 * automated/system-initiated decisions) — never an account profile, and
 * never a secret.
 *
 * Deterministic key: `${payloadId}::${action}` — mirrors
 * `toFedosConversationId`'s own `::`-joined convention (Alpha 743). At
 * most ONE `"tombstoned"` record and ONE `"payload-removed"` record can
 * ever exist per payload — a second, contradictory decision for the
 * SAME `(payloadId, action)` pair is a genuine
 * `FedosPayloadRetentionPersistence`-level `"conflict"`, never silently
 * overwritten (mirrors every other port in this codebase).
 *
 * HARD GUARDRAILS:
 *   - Every field `readonly`; no mutation method.
 *   - No plaintext, no secret, no account profile.
 *   - Only `validateFedosPayloadRetentionDecision`
 *     (`./fedos_payload_retention_decision_validator.ts`) may construct
 *     a value of this type.
 */

import type { FedosConversationPayloadId } from "../../../../conversation/payload_storage/fedos_conversation_payload_id.js";

/** Alpha 795 — deliberately excludes `"active"` (see this file's own header). */
export type FedosPayloadRetentionAction = "tombstoned" | "payload-removed";

/** Closed vocabulary, mirroring `FedosBoardModerationReasonCode`'s own `_placeholder` discipline (Alpha 258) — no free-form reason. */
export type FedosPayloadRetentionReasonCode =
  | "user_requested_placeholder"
  | "policy_placeholder"
  | "test_placeholder";

export interface FedosPayloadRetentionDecision {
  readonly payloadId: FedosConversationPayloadId;
  readonly action: FedosPayloadRetentionAction;
  /** Unix seconds, matching `FedosConversationRecord.createdAt`'s own convention. */
  readonly decidedAt: number;
  /** Opaque, non-secret reference; `null` for an automated/system-initiated decision. */
  readonly authorityReference: string | null;
  readonly reasonCode: FedosPayloadRetentionReasonCode;
}

/** Deterministic key, mirroring `toFedosConversationId`'s own `::`-joined convention (Alpha 743). */
export function fedosPayloadRetentionDecisionKey(payloadId: FedosConversationPayloadId, action: FedosPayloadRetentionAction): string {
  return `${payloadId}::${action}`;
}
