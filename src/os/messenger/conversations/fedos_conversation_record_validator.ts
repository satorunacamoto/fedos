/**
 * Secure Runtime Alpha 748 ("Conversation Record Validation") — Stage 8
 * of the Alpha 741–760 Canonical Conversation Identity and Record
 * Foundation Arc.
 *
 * The ONLY place in this repository that constructs a
 * `FedosConversationRecord` (`./fedos_conversation_record.ts`, Alpha
 * 745) — mirrors `validateFedosBoardPost`'s own "typed builder, sole
 * constructor, fail-closed to `null`, never throws" discipline
 * (`../board/fedos_board_post_validator.ts`, Alpha 257).
 *
 * Enforces, in order:
 *   - exact field set (no unknown/extra field — mirrors
 *     `deserializeFedosBoardPost`'s own `hasOnlyAllowedKeys` discipline,
 *     applied here at CONSTRUCTION time too, not only at deserialization
 *     time).
 *   - `mode` — `"public"` only, this Arc's own V1 scope (Alpha 744); any
 *     other value (including the two recognized-but-unsupported
 *     `FedosConversationMode` literals) fails closed.
 *   - well-formed, non-empty `boardId`/`rootThreadId`/`rootPostId`.
 *   - `rootPostId === rootThreadId` — the Alpha 747 Root Mapping
 *     Contract's own enforceable invariant: every V1 Conversation is
 *     anchored at exactly one root post that also defines its Thread.
 *   - `createdAt` — Unix seconds, reusing `FedosBoardPost`'s own
 *     accepted range (`FEDOS_BOARD_POST_MIN_CREATED_AT`/`MAX_CREATED_AT`,
 *     `../board/fedos_board_post_validator.ts`) rather than inventing a
 *     second timestamp policy.
 *   - `policyReference` — `"public-v1"` only, this Arc's own one V1 tag.
 *
 * HARD GUARDRAILS:
 *   - Fails closed: every rejection returns `null`. Never throws.
 *   - No network, no storage mutation, no identity resolution, no
 *     Board/Thread existence check (that is `FedosBoardRuntime`'s own
 *     Alpha 754/755 integration responsibility, not this pure
 *     boundary's).
 *   - Deep-copies and `Object.freeze`s the result, never the caller's
 *     own reference — matches `validateFedosBoardPost`'s convention.
 */

import {
  toFedosBoardId,
  toFedosBoardPostId,
  toFedosThreadId,
  type FedosBoardId,
  type FedosBoardPostId,
  type FedosThreadId,
} from "../../../board/fedos_board_identifiers.js";
import {
  FEDOS_BOARD_POST_MAX_CREATED_AT,
  FEDOS_BOARD_POST_MIN_CREATED_AT,
} from "../../../board/fedos_board_post_validator.js";
import type { FedosConversationId } from "../../../conversation/fedos_conversation_id.js";
import type { FedosConversationRecord, FedosConversationPolicyReference } from "../../../conversation/fedos_conversation_record.js";

/** The typed candidate `FedosBoardRuntime` builds before calling `validateFedosConversationRecord`. */
export interface FedosConversationRecordInput {
  readonly id: string;
  readonly mode: string;
  readonly boardId: string;
  readonly rootThreadId: string;
  readonly rootPostId: string;
  readonly policyReference: string;
  readonly createdAt: number;
}

const EXPECTED_KEYS: readonly string[] = [
  "boardId",
  "createdAt",
  "id",
  "mode",
  "policyReference",
  "rootPostId",
  "rootThreadId",
].sort();

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

/**
 * Validates and constructs a `FedosConversationRecord`. See this file's
 * own header for the full ordered check list.
 */
export function validateFedosConversationRecord(input: FedosConversationRecordInput): FedosConversationRecord | null {
  if (input === null || typeof input !== "object") return null;

  const keys = Object.keys(input).sort();
  if (keys.length !== EXPECTED_KEYS.length || !keys.every((key, index) => key === EXPECTED_KEYS[index])) {
    return null;
  }

  if (input.mode !== "public") return null;

  const id = isNonEmptyString(input.id) ? (input.id as FedosConversationId) : null;
  const boardId: FedosBoardId | null = isNonEmptyString(input.boardId) ? toFedosBoardId(input.boardId) : null;
  const rootThreadId: FedosThreadId | null = isNonEmptyString(input.rootThreadId)
    ? toFedosThreadId(input.rootThreadId)
    : null;
  const rootPostId: FedosBoardPostId | null = isNonEmptyString(input.rootPostId)
    ? toFedosBoardPostId(input.rootPostId)
    : null;
  if (id === null || boardId === null || rootThreadId === null || rootPostId === null) return null;

  // Alpha 747 Root Mapping Contract: a V1 Conversation's root post is
  // always its own thread's root (id === threadId, Alpha 631).
  if ((rootPostId as unknown as string) !== (rootThreadId as unknown as string)) return null;

  if (!isValidCreatedAt(input.createdAt)) return null;

  if (input.policyReference !== "public-v1") return null;
  const policyReference: FedosConversationPolicyReference = "public-v1";

  return Object.freeze({
    id,
    mode: "public" as const,
    boardId,
    rootThreadId,
    rootPostId,
    policyReference,
    createdAt: input.createdAt,
  });
}
