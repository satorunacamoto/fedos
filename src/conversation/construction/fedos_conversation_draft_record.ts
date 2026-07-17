/**
 * Secure Runtime Alpha 894 ("Conversation Record Compatibility") — Stage
 * 4 of Phase A of the Alpha 891–930 Private Conversation Draft
 * Construction and Readiness Runtime Arc.
 *
 * Alpha 894 compared, for how to carry a private draft's lifecycle:
 *   A. add `lifecycleState` to the existing `FedosConversationRecord` V1
 *      (`../fedos_conversation_record.ts`) — REJECTED. V1 is already
 *      durably persisted (`FedosPersistedConversationRecordV1`, Alpha
 *      750, with a closed field set enforced at read time); adding a
 *      field silently changes that schema and would invalidate the
 *      exact-key check every existing public log line already passes.
 *   B. a versioned Conversation Record V2 — the DIRECTION adopted, but
 *      as a SEPARATE record type (this file), NOT a second version of
 *      the public record: a private draft has no `boardId`/`rootThreadId`/
 *      `rootPostId` (it is not anchored to a Board thread — Alpha 908),
 *      so reusing the public record's own field set would mean carrying
 *      four fields that are meaningless for a draft.
 *   C. a separate lifecycle/readiness record joined to V1 by id —
 *      REJECTED as heavier than needed: it would split one private draft
 *      across two append-only logs with their own cross-log coordination,
 *      for a lifecycle field that has exactly one legal value in this Arc
 *      (`"draft"`).
 *   D. infer lifecycle externally — REJECTED: "no field without a
 *      writer" cuts both ways ("no writer without a field") — an
 *      inferred lifecycle has no durable, restart-stable record.
 *
 * DECISION: B, as a NEW, standalone, versioned draft record —
 * `FedosConversationDraftRecord`. The public `FedosConversationRecord`,
 * its validator, codec, persistence, and reader are ALL byte-for-byte
 * UNCHANGED; every existing public V1 log stays valid and readable
 * (Alpha 900/919). Because this record type is brand new, no migration of
 * any existing log exists — `lifecycleState` is carried inline safely, on
 * a record whose own persisted form (`FedosPersistedConversationDraftRecordV1`)
 * has no prior generation to reconcile with.
 *
 * `mode` is `"private-group" | "direct"` ONLY — the public `"public"`
 * mode is never a draft; it stays on `FedosConversationRecord`. `creator`
 * is carried on the record (a private draft's owner is intrinsic to it,
 * unlike a public thread whose author lives on its root post) — it is a
 * `FedosConversationParticipantReference`, never a secret, never a
 * display pseudonym.
 *
 * Explicitly EXCLUDED (this Arc's own Absolute Prohibitions):
 *   - any bearer secret / key / key-epoch field — a draft record holds
 *     NO secret material of any kind (Alpha 907/928).
 *   - any ciphertext/plaintext payload — a draft is metadata only.
 *   - member list — Membership is its own durable domain, keyed by this
 *     record's id, never duplicated here.
 *   - `isActive`/`isPrivate`/`isEncrypted` boolean — `mode` +
 *     `lifecycleState` are closed enums; a parallel boolean could
 *     disagree (Alpha 893).
 *
 * HARD GUARDRAILS:
 *   - Every field `readonly`.
 *   - Only `validateFedosConversationDraftRecord`
 *     (`./fedos_conversation_draft_record_validator.ts`) constructs one.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import type { FedosPrivateConversationMode } from "./fedos_private_conversation_id.js";
import type { FedosConversationLifecycleState } from "./fedos_conversation_lifecycle_state.js";

/** The V1 policy-reference tags a private draft may carry (Alpha 896). A future Arc adds tags additively, never rewriting these. */
export type FedosPrivateConversationPolicyReference = "private-group-draft-v1" | "direct-draft-v1";

export interface FedosConversationDraftRecord {
  readonly id: FedosConversationId;
  readonly mode: FedosPrivateConversationMode;
  /** V1: always `"draft"` — see `validateFedosConversationDraftRecord`. */
  readonly lifecycleState: FedosConversationLifecycleState;
  readonly policyReference: FedosPrivateConversationPolicyReference;
  /** The owner/creator — resolved by the coordinator, never caller-supplied (Alpha 901/904). */
  readonly creator: FedosConversationParticipantReference;
  /** Unix seconds, matching `FedosConversationRecord.createdAt`'s own convention. */
  readonly createdAt: number;
}
