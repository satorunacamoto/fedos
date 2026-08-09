/**
 * Secure Runtime Alpha 894 ("Conversation Record Compatibility") — the
 * ONLY two functions permitted to convert between the runtime
 * `FedosConversationDraftRecord` (Alpha 894) and its persisted wire shape
 * `FedosPersistedConversationDraftRecordV1` — mirrors
 * `serializeFedosConversationRecord`/`deserializeFedosConversationRecord`'s
 * own exact discipline (Alpha 750).
 *
 * HARD GUARDRAILS:
 *   - `deserializeFedosConversationDraftRecord` fails closed: `null` for
 *     anything malformed, never throws.
 *   - `schemaVersion` checked EXACTLY against `1` — an unknown future
 *     schema is rejected, never migrated.
 *   - Unknown top-level fields are REJECTED.
 *   - Reuses `validateFedosConversationDraftRecord` (Alpha 895) rather
 *     than re-implementing any check.
 */

import {
  validateFedosConversationDraftRecord,
  type FedosConversationDraftRecordInput,
} from "../../../../conversation/construction/fedos_conversation_draft_record_validator.js";
import type { FedosConversationDraftRecord } from "../../../../conversation/construction/fedos_conversation_draft_record.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../../../../conversation/construction/fedos_persisted_conversation_draft_record_v1.js";

/** Deep-copies `record` into the persisted V1 wire shape, flattening `creator`. */
export function serializeFedosConversationDraftRecord(
  record: FedosConversationDraftRecord,
): FedosPersistedConversationDraftRecordV1 {
  return {
    schemaVersion: 1,
    id: record.id,
    mode: record.mode,
    lifecycleState: record.lifecycleState,
    policyReference: record.policyReference,
    creatorAuthority: record.creator.authority,
    creatorPublicIdentifier: record.creator.publicIdentifier,
    creatorIdentityId: record.creator.identityId,
    createdAt: record.createdAt,
  };
}

const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "id",
  "mode",
  "lifecycleState",
  "policyReference",
  "creatorAuthority",
  "creatorPublicIdentifier",
  "creatorIdentityId",
  "createdAt",
]);

interface RawTopLevelFields {
  readonly schemaVersion: unknown;
  readonly id: unknown;
  readonly mode: unknown;
  readonly lifecycleState: unknown;
  readonly policyReference: unknown;
  readonly creatorAuthority: unknown;
  readonly creatorPublicIdentifier: unknown;
  readonly creatorIdentityId: unknown;
  readonly createdAt: unknown;
}

/** Fails closed to `null` for any malformed, unrecognized-schema, or corrupt input. */
export function deserializeFedosConversationDraftRecord(record: unknown): FedosConversationDraftRecord | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => TOP_LEVEL_KEYS.has(key))) return null;

  const {
    schemaVersion,
    id,
    mode,
    lifecycleState,
    policyReference,
    creatorAuthority,
    creatorPublicIdentifier,
    creatorIdentityId,
    createdAt,
  } = record as RawTopLevelFields;

  if (schemaVersion !== 1) return null;
  if (typeof id !== "string") return null;
  if (typeof mode !== "string") return null;
  if (typeof lifecycleState !== "string") return null;
  if (typeof policyReference !== "string") return null;
  if (typeof creatorAuthority !== "string") return null;
  if (typeof creatorPublicIdentifier !== "string") return null;
  if (creatorIdentityId !== null && typeof creatorIdentityId !== "string") return null;
  if (typeof createdAt !== "number") return null;

  const input: FedosConversationDraftRecordInput = {
    id,
    mode,
    lifecycleState,
    policyReference,
    creator: {
      authority: creatorAuthority,
      publicIdentifier: creatorPublicIdentifier,
      identityId: creatorIdentityId,
    },
    createdAt,
  };

  return validateFedosConversationDraftRecord(input);
}
