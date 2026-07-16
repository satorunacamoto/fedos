/**
 * Secure Runtime Alpha 750 ("Persisted Conversation Record V1") — Stage
 * 10 of the Alpha 741–760 Canonical Conversation Identity and Record
 * Foundation Arc.
 *
 * The ONLY two functions permitted to convert between the runtime
 * `FedosConversationRecord` (`../fedos_conversation_record.ts`, Alpha
 * 745) and the persisted wire shape `FedosPersistedConversationRecordV1`
 * (`./fedos_persisted_conversation_record_v1.ts`) — mirrors
 * `serializeFedosBoardPost`/`deserializeFedosBoardPost`'s own exact
 * discipline (`../../board/persistence/fedos_board_post_codec.ts`,
 * Alpha 314).
 *
 * HARD GUARDRAILS:
 *   - `deserializeFedosConversationRecord` fails closed: `null` for
 *     anything malformed, never throws.
 *   - `schemaVersion` checked EXACTLY against `1` — an unknown future
 *     schema is rejected, never guessed at or migrated.
 *   - Unknown top-level fields are REJECTED, not silently ignored.
 *   - `deserializeFedosConversationRecord` reuses
 *     `validateFedosConversationRecord` (Alpha 748, unmodified) rather
 *     than re-implementing any of its own checks.
 */

import {
  validateFedosConversationRecord,
  type FedosConversationRecordInput,
} from "../fedos_conversation_record_validator.js";
import type { FedosConversationRecord } from "../fedos_conversation_record.js";
import type { FedosPersistedConversationRecordV1 } from "./fedos_persisted_conversation_record_v1.js";

/** Deep-copies `record` into the persisted V1 wire shape. */
export function serializeFedosConversationRecord(record: FedosConversationRecord): FedosPersistedConversationRecordV1 {
  return {
    schemaVersion: 1,
    id: record.id,
    mode: record.mode,
    boardId: record.boardId,
    rootThreadId: record.rootThreadId,
    rootPostId: record.rootPostId,
    policyReference: record.policyReference,
    createdAt: record.createdAt,
  };
}

const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "id",
  "mode",
  "boardId",
  "rootThreadId",
  "rootPostId",
  "policyReference",
  "createdAt",
]);

interface RawTopLevelFields {
  readonly schemaVersion: unknown;
  readonly id: unknown;
  readonly mode: unknown;
  readonly boardId: unknown;
  readonly rootThreadId: unknown;
  readonly rootPostId: unknown;
  readonly policyReference: unknown;
  readonly createdAt: unknown;
}

/** Fails closed to `null` for any malformed, unrecognized-schema, or corrupt input. */
export function deserializeFedosConversationRecord(record: unknown): FedosConversationRecord | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => TOP_LEVEL_KEYS.has(key))) return null;

  const { schemaVersion, id, mode, boardId, rootThreadId, rootPostId, policyReference, createdAt } =
    record as RawTopLevelFields;

  if (schemaVersion !== 1) return null;
  if (typeof id !== "string") return null;
  if (typeof mode !== "string") return null;
  if (typeof boardId !== "string") return null;
  if (typeof rootThreadId !== "string") return null;
  if (typeof rootPostId !== "string") return null;
  if (typeof policyReference !== "string") return null;
  if (typeof createdAt !== "number") return null;

  const input: FedosConversationRecordInput = {
    id,
    mode,
    boardId,
    rootThreadId,
    rootPostId,
    policyReference,
    createdAt,
  };

  return validateFedosConversationRecord(input);
}
