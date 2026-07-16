/**
 * Secure Runtime Alpha 624 ("Command Result Vocabulary") / Alpha 625
 * ("Public Command Model") — Stages 4–5 of the Alpha 621–640 Public
 * Board Runtime Application API Foundation Arc.
 *
 * Command inputs a caller may supply, and what `FedosBoardRuntime`
 * ever returns — deliberately excludes, on the COMMAND side:
 *   - post id (Alpha 626: Authority-derived, `FedosBoardRuntimeIdGenerator`)
 *   - author public identifier / identityId / signature (Alpha 627:
 *     Authority-derived, `resolvePublicAuthorReference()`)
 *   - `source` (Alpha 628: Authority-derived, always
 *     `{ protocol: "fedos", reference: <the post's own generated id> }`
 *     for a `FedosBoardRuntime`-authored post)
 *   - `createdAt` (Alpha 625/`fedos_board_runtime_clock.ts`:
 *     Authority-derived, injected `FedosBoardRuntimeClock`)
 *   - delivery observation / retry state (never caller input or
 *     command output anywhere in this Arc)
 * and, on the RESULT side, excludes any raw `Error` object, stack
 * trace, or raw Publisher/provider message — every outcome is a closed
 * string-literal token, per Alpha 624's own "曖昧なbooleanを使わない"
 * requirement, minimized to the outcomes `FedosDesktopHost.submitPost()`/
 * `submitPostWithOutbox()` can ACTUALLY produce
 * (`FedosDesktopHostSubmitPostResult`/`FedosBoardOutboxPersistenceWriteResult`,
 * `src/desktop/host/fedos_desktop_host.ts`) — no outcome invented here
 * that Host itself has no way of ever producing.
 *
 * Secure Runtime Alpha 667 ("BoardRuntime Command Integration") adds
 * exactly two new `"invalid-command"` reasons:
 *   - `"unsupported-conversation-mode"` — reachable only if a future,
 *     non-V1 `FedosConversationPolicyAuthority` ever resolved a policy
 *     this Arc's own vocabulary does not accept; structurally
 *     UNREACHABLE today, since `StaticFedosConversationPolicyAuthority`
 *     (the only V1 implementation) always resolves `"public"`.
 *   - `"author-conflict"` — a resolved-but-structurally-malformed
 *     identity (`FedosPublicAuthorResolution`'s own `"conflict"`
 *     outcome, Alpha 643/644) fails the command closed, explicitly,
 *     rather than either silently downgrading to anonymous-local
 *     authorship or silently blocking as `"unavailable"` (which would
 *     misleadingly imply the Host itself is not ready).
 * No other field on this file changed.
 */

import type { FedosBoardOutboxTarget } from "../outbox/fedos_board_outbox_types.js";
import type { FedosBoardPost } from "../fedos_board_post.js";

/** Caller input for a new public thread (= a new root post; see Alpha 631 — no separate "board post" API exists). */
export interface CreatePublicThreadCommand {
  readonly boardId: string;
  readonly body: string;
  /** Optional, explicit outbound protocol targets. Omitted/empty = local-only (Alpha 634). */
  readonly outboundTargets?: readonly FedosBoardOutboxTarget[];
}

/** Caller input for a reply into an existing public thread. */
export interface ReplyToPublicThreadCommand {
  readonly boardId: string;
  readonly threadId: string;
  readonly replyTo: string;
  readonly body: string;
  /** Optional, explicit outbound protocol targets. Omitted/empty = local-only (Alpha 634). */
  readonly outboundTargets?: readonly FedosBoardOutboxTarget[];
}

/** One caller-requested outbound target's own outcome — never hidden inside an aggregate boolean (Alpha 636: "partial successを隠さない"). */
export interface FedosBoardRuntimeOutboxTargetResult {
  readonly target: FedosBoardOutboxTarget;
  /** `FedosBoardOutboxPersistenceWriteResult` verbatim (`../outbox/fedos_board_outbox_persistence.js`), OR `"ineligible"` when Alpha 633's own Outbound Eligibility gate rejected this target BEFORE any Outbox intent was ever created. */
  readonly result: "inserted" | "already-present" | "conflict" | "failed" | "ineligible";
}

/**
 * Every outcome `FedosBoardRuntime.createPublicThread()`/
 * `replyToPublicThread()` can ever return. `"created"`/
 * `"already-present"`/`"outbox-partial-failure"` all carry the
 * constructed `post` (the Runtime already holds it locally — no extra
 * Host read is needed) plus the FULL per-target outbox outcome array
 * (empty when no `outboundTargets` were supplied). `"outbox-partial-
 * failure"` fires precisely when the post write itself succeeded
 * (`"created"`/`"already-present"`) but at least one requested target
 * did NOT reach `"inserted"`/`"already-present"`.
 */
export type FedosBoardRuntimeCommandResult =
  | { readonly outcome: "created"; readonly post: FedosBoardPost; readonly outbox: readonly FedosBoardRuntimeOutboxTargetResult[] }
  | { readonly outcome: "already-present"; readonly post: FedosBoardPost; readonly outbox: readonly FedosBoardRuntimeOutboxTargetResult[] }
  | { readonly outcome: "outbox-partial-failure"; readonly post: FedosBoardPost; readonly outbox: readonly FedosBoardRuntimeOutboxTargetResult[] }
  | { readonly outcome: "conflict"; readonly reason: "post-id-conflict" | "source-conflict" }
  | {
      readonly outcome: "invalid-command";
      readonly reason:
        | "malformed-post"
        | "missing-parent"
        | "invalid-thread"
        | "cross-board-reply"
        | "unsupported-conversation-mode"
        | "author-conflict";
    }
  | { readonly outcome: "unavailable" }
  | { readonly outcome: "persistence-failed" };
