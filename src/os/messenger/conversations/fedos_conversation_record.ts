/**
 * Secure Runtime Alpha 745 ("Conversation Record V1 Decision") — Stage 5
 * of the Alpha 741–760 Canonical Conversation Identity and Record
 * Foundation Arc.
 *
 * The minimum IMMUTABLE shape a Canonical Conversation carries in V1.
 * Mirrors `FedosBoardPost`'s own "every field readonly, no speculative
 * field" discipline (`../board/fedos_board_post.ts`, Alpha 255).
 *
 * Alpha 746 ("Policy Reference Decision") — compared:
 *   A. full immutable policy embedded — rejected; would duplicate
 *      `FedosConversationPolicy` into every record, and Alpha 654
 *      already decided policy is NOT embedded per-post/per-record.
 *   B. policy ID/reference — the shape adopted, in its smallest honest
 *      form (see D below).
 *   C. no policy field at all — rejected; a record with no trace of
 *      which policy governed it at creation time cannot be reconciled
 *      later if a second policy value is ever introduced.
 *   D. policy version/hash — ADOPTED, as a fixed string-literal tag
 *      (`"public-v1"`), not a hash: `FedosConversationPolicyAuthority`
 *      today (`StaticFedosConversationPolicyAuthority`) is itself
 *      RUNTIME-STATIC — every V1 Conversation shares the exact same
 *      `FEDOS_CONVERSATION_POLICY_PUBLIC_V1` value, never persisted,
 *      never versioned beyond this one fixed value (Alpha 654's own
 *      "no unnecessary persistence for V1" decision) — so a hash would
 *      claim precision ("this exact policy content, byte for byte") this
 *      Arc cannot honestly back with any persisted policy history. A
 *      literal tag names the fixed policy generation this record was
 *      created under, nothing more.
 *
 * Alpha 747 ("Root Mapping Contract"): every V1 Conversation record is
 * anchored at exactly the root post that also defines its Thread — only
 * `FedosBoardRuntime.createPublicThread()` ever constructs one (Alpha
 * 754), and a Thread's root post already satisfies `id === threadId`
 * (Alpha 631, unchanged). `rootPostId === rootThreadId` is therefore a
 * real, enforceable V1 invariant, checked by
 * `validateFedosConversationRecord` below — NOT an incidental
 * coincidence: replies never create a second Conversation record (Alpha
 * 755), so no V1 record can ever exist whose root post is NOT also its
 * own thread's root. This is also why `03/07's own "is a separate index
 * needed to look up a Conversation by Thread ID" question resolves to
 * "no" — `toFedosConversationId(boardId, threadId)` alone is always
 * enough (`./fedos_conversation_id.ts`).
 *
 * Explicitly EXCLUDED (this Arc's own Absolute Prohibitions, and Alpha
 * 745's own instruction):
 *   - plaintext body / ciphertext — a Conversation record is metadata
 *     ABOUT a thread, never a duplicate of its content.
 *   - member list — no membership authority exists (Alpha 749 §Absolute
 *     Prohibitions); a field here with nothing to populate or enforce
 *     it would be exactly the "fake allow-all membership" risk this
 *     Arc must not introduce.
 *   - invitation / secret — no capability model exists this Arc.
 *   - delivery status — already owned by `FedosBoardOutboxIntent`/
 *     `FedosDeliveryObservation`; duplicating it here would create a
 *     second source of truth for the same fact.
 *   - author profile — a Conversation is not scoped to one author (a
 *     thread may have many repliers); this would also duplicate
 *     `FedosBoardAuthorReference` data already carried by the root post.
 *   - arbitrary metadata bag — matches `FedosBoardPost`'s own
 *     "speculative fields are explicitly disallowed" rule.
 *   - mutable `deleted`/`private` boolean — `mode` already expresses
 *     public/private as a closed enum; see
 *     `docs/secure_runtime_alpha_745_conversation_record_v1_decision.md`
 *     for why a second boolean would let the two disagree. No
 *     lifecycle field either — see that same doc's own "no field
 *     without a writer" reasoning; nothing in this Arc's scope ever
 *     produces a lifecycle transition.
 *
 * HARD GUARDRAILS:
 *   - Every field is `readonly`; no mutation method or setter.
 *   - Only `validateFedosConversationRecord`
 *     (`./fedos_conversation_record_validator.ts`) may construct a
 *     value of this type — the same "validator is the sole
 *     constructor" discipline `FedosBoardPost` already established.
 */

import type { FedosBoardId, FedosBoardPostId, FedosThreadId } from "../../../board/fedos_board_identifiers.js";
import type { FedosConversationMode } from "../../../board/runtime/policy/fedos_conversation_mode.js";
import type { FedosConversationId } from "../../../conversation/fedos_conversation_id.js";

/** Alpha 746 — see this file's own header. The only V1 value; a future Arc introduces new tags additively, never rewriting this one. */
export type FedosConversationPolicyReference = "public-v1";

export interface FedosConversationRecord {
  readonly id: FedosConversationId;
  /** V1: always `"public"` — see `validateFedosConversationRecord`. */
  readonly mode: FedosConversationMode;
  readonly boardId: FedosBoardId;
  /** The Conversation's root Thread — `rootThreadId === rootPostId` for every V1 record (see this file's own header). */
  readonly rootThreadId: FedosThreadId;
  readonly rootPostId: FedosBoardPostId;
  readonly policyReference: FedosConversationPolicyReference;
  /** Unix seconds, matching `FedosBoardPost.createdAt`'s own convention. The root post's own `createdAt` — a Conversation is never created before its root post. */
  readonly createdAt: number;
}
