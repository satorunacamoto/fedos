/**
 * Secure Runtime Alpha 4181-4260 ("Desktop Conversation Window and
 * Navigation Arc") — Phase C: Navigation State.
 *
 * `FedosConversationNavigationState` is the ONE closed state vocabulary a
 * single window's navigation can be in. No implicit transitions: every
 * state change below is produced by one of the four exported pure
 * functions, never by a caller constructing a state object literal
 * directly (every field is only ever set by this file). No content lives
 * here — this is navigation bookkeeping only ("which conversation id is
 * this window pointed at, and how did it get there"), never a
 * `FedosConversationDetailView`, ViewModel, Shell, or Runtime reference.
 *
 * HARD GUARDRAILS:
 *   - No I/O, no Shell/Runtime/persistence call, no async — pure data and
 *     pure functions only, mirroring `fedos_desktop_view_model_state.ts`'s
 *     own "closed shape + tiny pure constructors" discipline one layer
 *     further out (navigation, not content-loading).
 *   - `"empty"` (no conversation open) and `"opening"` (a
 *     Controller-level `openConversation()`/`switchConversation()` call is
 *     in flight) are distinct from `"open"`/`"open-failed"` — a caller can
 *     tell "nothing shown yet" from "something failed to show" without
 *     inspecting a reason string.
 *   - `"open-failed"` still carries the `conversationId` that was
 *     attempted (never discarded) so a UI can offer "retry" without the
 *     caller re-supplying the id.
 */

export type FedosConversationNavigationState =
  | { readonly kind: "empty" }
  | { readonly kind: "opening"; readonly conversationId: string }
  | { readonly kind: "open"; readonly conversationId: string }
  | { readonly kind: "open-failed"; readonly conversationId: string; readonly outcome: string; readonly reason: string };

export function fedosNavigationEmpty(): FedosConversationNavigationState {
  return Object.freeze({ kind: "empty" });
}

export function fedosNavigationOpening(conversationId: string): FedosConversationNavigationState {
  return Object.freeze({ kind: "opening", conversationId });
}

export function fedosNavigationOpen(conversationId: string): FedosConversationNavigationState {
  return Object.freeze({ kind: "open", conversationId });
}

export function fedosNavigationOpenFailed(conversationId: string, outcome: string, reason: string): FedosConversationNavigationState {
  return Object.freeze({ kind: "open-failed", conversationId, outcome, reason });
}

/** The conversation id a state is (or was, for `"open-failed"`) about — `null` only for `"empty"`. Never re-derives anything; a direct field read wrapped for callers that want one accessor across all four kinds. */
export function fedosNavigationStateConversationId(state: FedosConversationNavigationState): string | null {
  return state.kind === "empty" ? null : state.conversationId;
}
