/**
 * Secure Runtime Alpha 7801-7880 (FedOS Direct Conversation Archive
 * Product Completion and Parallel-Lineage Integration Arc).
 *
 * `FedosConversationArchiveBundleV1.conversation`'s own pre-existing
 * type, `FedosPersistedConversationRecordV1` (Alpha 750), is valid ONLY
 * for a PUBLIC, Board-thread-anchored Conversation
 * (`validateFedosConversationRecord` hard-rejects any `mode` other than
 * `"public"`) — a real `private-group`/`direct` Conversation is NEVER
 * written into that persistence port at all in this codebase (confirmed
 * by `git grep putConversation` and re-verified directly against
 * `fedos_conversation_active_lookup.ts`; a prior Arc's own Group
 * Archive Collector comment, Alpha 1921-1980, already names this exact
 * gap and deliberately deferred it). This file defines the NARROW,
 * ADDITIVE alternative shape for a Direct Conversation Archive subject,
 * so this Arc closes that gap WITHOUT manufacturing a fake Board record
 * for a Direct Conversation (an absolute prohibition this Arc names
 * explicitly) and WITHOUT a global Archive schema-version bump (the
 * coarse `fedos_conversation_archive_bundle_codec.ts` only ever checks
 * that `conversation` is a non-null object — it never validates its
 * internal shape, deferring that to Restore, exactly like every other
 * nested domain record already does).
 *
 * `FedosConversationArchiveSubject` is the union
 * `FedosPersistedConversationRecordV1 | FedosConversationArchiveDirectConversationSubjectV1`.
 * Detection is BY THE PRESENCE of this new type's own `kind: "direct"`
 * discriminator field: a bare object with no `kind` field (every Board
 * Archive ever produced by this codebase, including every one already
 * on a user's disk) is the pre-existing `FedosPersistedConversationRecordV1`
 * shape, read exactly as before; an object with `kind === "direct"` is
 * this new shape. `kind` itself IS the version marker for this
 * capability — no separate schema-version field or bump is needed. An
 * object carrying any OTHER `kind` value (or a `kind` field of the
 * wrong type) fails closed as an unsupported/unknown subject —
 * `isFedosConversationArchiveDirectConversationSubject()` returns
 * `false` for it, and callers must never guess a fallback
 * interpretation.
 *
 * `record` is `FedosPersistedConversationDraftRecordV1` (Alpha 894) —
 * an ALREADY-EXISTING, already-frozen, plain-serializable wire shape
 * (id/mode/lifecycleState/policyReference/creatorAuthority/
 * creatorPublicIdentifier/creatorIdentityId/createdAt) reused VERBATIM,
 * never a new record shape invented for this Arc's own purposes. No
 * Ratchet session metadata, no Master Seed, no private key, no
 * SecretHandle of any kind is carried here or anywhere in this file.
 *
 * HARD GUARDRAILS:
 *   - This file defines TYPES and pure predicate/guard functions ONLY —
 *     no class, no persistence, no mutation.
 *   - `FedosConversationArchiveDirectConversationSubjectV1` and its own
 *     guard are the ONLY exports besides the union type alias.
 */

import type { FedosPersistedConversationDraftRecordV1 } from "../../../../conversation/construction/fedos_persisted_conversation_draft_record_v1.js";
import type { FedosPersistedConversationRecordV1 } from "../../../../conversation/persistence/fedos_persisted_conversation_record_v1.js";

export interface FedosConversationArchiveDirectConversationSubjectV1 {
  readonly kind: "direct";
  readonly record: FedosPersistedConversationDraftRecordV1;
}

/** The full closed set `FedosConversationArchiveBundleV1.conversation` may now hold. */
export type FedosConversationArchiveSubject =
  | FedosPersistedConversationRecordV1
  | FedosConversationArchiveDirectConversationSubjectV1;

function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

/**
 * Fail-closed structural guard: `true` iff `value` is genuinely the new
 * Direct subject shape (`kind === "direct"` and `record` is itself a
 * non-null object — deep field-level validation of `record` is
 * Restore's own job, via the EXISTING, unmodified
 * `deserializeFedosConversationDraftRecord`/validator, mirroring every
 * other nested domain's "coarse-here, fine-in-Restore" layering).
 * `false` for a bare Board record (no `kind` field at all), for any
 * OTHER `kind` value, and for anything malformed — never throws.
 */
export function isFedosConversationArchiveDirectConversationSubject(
  value: unknown,
): value is FedosConversationArchiveDirectConversationSubjectV1 {
  if (!isNonNullObject(value)) return false;
  if (value.kind !== "direct") return false;
  return isNonNullObject(value.record);
}

/**
 * `true` iff `value` is a bare object carrying no `kind` field at all —
 * the pre-existing, unversioned Board-subject shape every Archive this
 * codebase has ever produced before this Arc uses. Deep validation
 * remains Restore's own job (`deserializeFedosConversationRecord`,
 * unmodified). Never throws.
 */
export function isFedosConversationArchiveBoardConversationSubject(value: unknown): value is FedosPersistedConversationRecordV1 {
  return isNonNullObject(value) && !("kind" in value);
}
