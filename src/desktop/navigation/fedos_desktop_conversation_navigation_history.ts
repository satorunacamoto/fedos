/**
 * Secure Runtime Alpha 4181-4260 ("Desktop Conversation Window and
 * Navigation Arc") — Phase C: Navigation State (Back/Forward History).
 *
 * `FedosConversationNavigationHistory` is a closed, immutable value type —
 * two stacks of conversation ids (`back`/`forward`) plus the id currently
 * shown, if any. Every operation returns a NEW history value; none mutates
 * its receiver (mirrors every other closed-state value in
 * `src/desktop/presentation/`/`src/desktop/navigation/` — no hidden
 * mutable field anywhere in this file).
 *
 * Browser-tab semantics, deliberately: `push()` (a fresh
 * open/switch/close, including "close" itself as one more entry — closing
 * is a real navigation, undoable via `back()`) clears `forward` — the
 * SAME "a new navigation abandons the redo stack" rule every browser
 * history already uses. `back()`/`forward()` never invent a target the
 * caller didn't already visit — both return `null` (no-op) when the
 * respective stack is empty, never throw, never silently clamp to
 * whatever else looks reasonable.
 *
 * HARD GUARDRAILS:
 *   - No I/O, no Shell/Runtime call — pure data and pure functions only.
 *   - Entries are bare conversation id strings, or `null` for "the empty
 *     window" — never a `FedosConversationDetailView`/ViewModel state;
 *     re-loading the CONTENT for a history entry is the Controller's own
 *     job (Phase B), not this file's.
 */

export interface FedosConversationNavigationHistory {
  readonly current: string | null;
  readonly back: readonly (string | null)[];
  readonly forward: readonly (string | null)[];
}

export function fedosNavigationHistoryEmpty(): FedosConversationNavigationHistory {
  return Object.freeze({ current: null, back: Object.freeze([]), forward: Object.freeze([]) });
}

/** Records a new navigation to `conversationId` (or `null` for "closed to empty"). Pushes the PRIOR `current` onto `back`; always clears `forward`. A push to the SAME id as the current one is still recorded (an explicit re-open/refresh is a real, distinct navigation event, never silently collapsed). */
export function fedosNavigationHistoryPush(history: FedosConversationNavigationHistory, conversationId: string | null): FedosConversationNavigationHistory {
  return Object.freeze({
    current: conversationId,
    back: Object.freeze([...history.back, history.current]),
    forward: Object.freeze([]),
  });
}

/** `null` (no-op — `back` is empty) when there is nowhere to go back to; otherwise the new history with `current` popped from `back` and the prior `current` pushed onto `forward`. */
export function fedosNavigationHistoryBack(history: FedosConversationNavigationHistory): FedosConversationNavigationHistory | null {
  if (history.back.length === 0) return null;
  const nextBack = history.back.slice(0, -1);
  const target = history.back[history.back.length - 1] ?? null;
  return Object.freeze({
    current: target,
    back: Object.freeze(nextBack),
    forward: Object.freeze([history.current, ...history.forward]),
  });
}

/** `null` (no-op — `forward` is empty) when there is nowhere to go forward to; otherwise the mirror image of `fedosNavigationHistoryBack`. */
export function fedosNavigationHistoryForward(history: FedosConversationNavigationHistory): FedosConversationNavigationHistory | null {
  if (history.forward.length === 0) return null;
  const [target, ...restForward] = history.forward;
  return Object.freeze({
    current: target ?? null,
    back: Object.freeze([...history.back, history.current]),
    forward: Object.freeze(restForward),
  });
}

export function fedosNavigationHistoryCanGoBack(history: FedosConversationNavigationHistory): boolean {
  return history.back.length > 0;
}

export function fedosNavigationHistoryCanGoForward(history: FedosConversationNavigationHistory): boolean {
  return history.forward.length > 0;
}
