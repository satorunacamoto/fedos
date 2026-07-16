/**
 * Secure Runtime Alpha 625 ("Public Command Model") — Stage 5 of the
 * Alpha 621–640 Public Board Runtime Application API Foundation Arc.
 *
 * `createdAt` compared against the SAME Authority-derived-vs-caller-
 * supplied question already settled for id/author/signature/source
 * (`docs/reviews/board_runtime_application_api_03_command_model.md`):
 * a caller-supplied `createdAt` on `CreatePublicThreadCommand`/
 * `ReplyToPublicThreadCommand` would let a caller backdate or
 * forward-date a post, directly manipulating `FedosBoardQuery.recentFeed()`'s
 * own `createdAt` DESC ordering (`src/board/query/fedos_board_query.ts`)
 * — the same class of integrity problem a caller-supplied id would
 * cause for `FedosBoardService`'s own dedupe/conflict logic.
 *
 * DECISION: `createdAt` is Runtime clock authority, NOT a public
 * command field — `CreatePublicThreadCommand`/`ReplyToPublicThreadCommand`
 * (`./fedos_board_runtime_command_types.ts`) carry no `createdAt` field
 * at all. This file's own `FedosBoardRuntimeClock` is injected into
 * `FedosBoardRuntime`'s constructor instead, mirroring
 * `FedosPublishSchedulerDependencies.now?: () => number`
 * (`src/board/outbox/fedos_publish_scheduler.ts`) — this codebase's own
 * already-established "injected clock for testability, real
 * `Date.now()`-derived value by default" precedent, applied a second
 * time rather than invented fresh.
 */

/** Returns the current time in Unix SECONDS, matching `FedosBoardPost.createdAt`'s own unit. */
export type FedosBoardRuntimeClock = () => number;

export function defaultFedosBoardRuntimeClock(): number {
  return Math.floor(Date.now() / 1000);
}
