/**
 * Secure Runtime Alpha 654 ("Policy Identifier and Ownership") / Alpha
 * 656 ("Conversation Policy Authority") — Stages 4/6 of the Alpha
 * 641–680 Public Identity, Conversation Policy & Application Runtime
 * Integration Arc.
 *
 * Alpha 654 compares:
 *   A. embed full policy in every `FedosBoardPost` — rejected; a
 *      canonical, immutable post (Alpha 255) would duplicate a
 *      changing policy field into every post it ever produced, and
 *      "changing" is exactly what a future mutable policy would be.
 *   B. separate immutable policy record keyed by Board/Conversation id
 *      — ADOPTED, WITHOUT unnecessary persistence for V1 (see below).
 *   C. `FedosBoardRuntime` constructor holds one global policy — too
 *      narrow: the interface below already accepts a `boardId`/
 *      `threadId`, so a future per-conversation policy authority can
 *      replace `StaticFedosConversationPolicyAuthority` without any
 *      `FedosBoardRuntime` change.
 *   D. caller supplies arbitrary policy with every post — REJECTED;
 *      would let a caller forge federation/write-access policy.
 *
 * DECISION: B, but V1 needs no real persistence — every Board/thread
 * shares the SAME fixed public policy today (no per-board
 * configuration exists anywhere in this codebase), so
 * `StaticFedosConversationPolicyAuthority` resolves the identical
 * `FEDOS_CONVERSATION_POLICY_PUBLIC_V1` value for every `(boardId,
 * threadId)` pair, ignoring both — this is the "fixed policy
 * authority" the Alpha 654 candidate explicitly permits instead of
 * unnecessary persistence. Policy ownership/mutation/versioning across
 * multiple, independently-configured Boards remains explicit FUTURE
 * WORK (see `docs/secure_runtime_alpha_659_policy_and_persistence_review.md`).
 */

import type { FedosBoardId, FedosThreadId } from "../../fedos_board_identifiers.js";
import { FEDOS_CONVERSATION_POLICY_PUBLIC_V1, type FedosConversationPolicy } from "./fedos_conversation_policy.js";

export interface FedosConversationPolicyResolutionInput {
  readonly boardId: FedosBoardId;
  readonly threadId: FedosThreadId | null;
}

/**
 * Alpha 656's own closed result vocabulary — mirrors
 * `FedosPublicAuthorResolution`'s own shape
 * (`../identity/fedos_public_author_authority.ts`). `"unsupported-mode"`
 * exists in the vocabulary for a future Authority that CAN resolve a
 * `private-group`/`direct` policy record but must still fail closed
 * because this Arc's own Application Runtime never accepts one
 * (Alpha 652) — no V1 Authority this Arc ships ever returns it, since
 * every Authority this Arc ships only ever resolves `"public"`.
 */
export type FedosConversationPolicyResolution =
  | { readonly outcome: "resolved"; readonly policy: FedosConversationPolicy }
  | { readonly outcome: "unsupported-mode" }
  | { readonly outcome: "unavailable" };

/**
 * Alpha 656. Exactly one method — no persistence method, no mutation
 * method, no Board/Thread lookup surface beyond the input it already
 * takes. A command caller never reaches this interface directly — only
 * `FedosBoardRuntime` consults it, exactly mirroring
 * `FedosPublicAuthorAuthority`'s own caller-unreachable shape.
 */
export interface FedosConversationPolicyAuthority {
  resolvePolicy(input: FedosConversationPolicyResolutionInput): Promise<FedosConversationPolicyResolution>;
}

/**
 * The ONE production implementation this Arc ships — resolves the
 * fixed `FEDOS_CONVERSATION_POLICY_PUBLIC_V1` policy for every input,
 * unconditionally. No persistence, no network, no Board/Thread
 * existence check (Alpha 654's own "no unnecessary persistence for V1"
 * decision) — `boardId`/`threadId` are accepted only to match the
 * interface shape a future, real per-conversation Authority would
 * need.
 */
export class StaticFedosConversationPolicyAuthority implements FedosConversationPolicyAuthority {
  async resolvePolicy(_input: FedosConversationPolicyResolutionInput): Promise<FedosConversationPolicyResolution> {
    return { outcome: "resolved", policy: FEDOS_CONVERSATION_POLICY_PUBLIC_V1 };
  }
}
