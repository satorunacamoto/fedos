/**
 * Secure Runtime Alpha 3241-3320 ("Desktop Local Conversation Management UI
 * Prototype Arc").
 *
 * `FedosDesktopViewModelState<T>` is the ONE shared, closed presentation-state
 * shape every ViewModel in `src/desktop/presentation/` returns and holds —
 * mirrors `FedosDesktopShellResult<T>`'s own "closed, coarse outcome" ethos
 * (`../shell/fedos_desktop_shell_result.ts`) one layer further out, adding
 * exactly the two states a synchronous Shell result cannot express on its
 * own: `"idle"` (no load attempted yet — distinct from a real, closed
 * "unavailable" outcome) and `"loading"` (an action is in flight — a future
 * UI needs this to disable a button / show a spinner without this file ever
 * importing a rendering framework to do so).
 *
 * This file owns NO business logic, NO persistence, NO Shell call of any
 * kind — it is a pure state-shape helper every ViewModel file composes.
 *
 * HARD GUARDRAILS (apply to every file under `src/desktop/presentation/`):
 *   - Every ViewModel delegates to `FedosDesktopApplicationShell`
 *     (`../shell/fedos_desktop_application_shell.ts`) for every fact and
 *     every mutation — never `conversationRuntime()`/`conversationContentAccessor()`
 *     directly, and never a persistence port, crypto authority, or secret.
 *   - No new business rule, authorization check, or outcome is invented
 *     here — every `"error"` state carries the EXACT `outcome`/`reason` the
 *     Shell itself already returned.
 *   - No rendering framework, no HTML/CSS, no browser global (`window`,
 *     `document`, `fetch`, timers for animation, etc.).
 *   - Any LOCAL, in-memory-only presentation state a ViewModel holds
 *     (a draft compose body, a search query, an unread watermark) is never
 *     durable — it is lost on process exit, and never written to any log,
 *     file, or persistence port.
 */

export type FedosDesktopViewModelState<T> =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly data: T }
  | { readonly status: "error"; readonly outcome: string; readonly reason: string };

export function fedosViewModelIdle<T>(): FedosDesktopViewModelState<T> {
  return Object.freeze({ status: "idle" });
}

export function fedosViewModelLoading<T>(): FedosDesktopViewModelState<T> {
  return Object.freeze({ status: "loading" });
}

export function fedosViewModelLoaded<T>(data: T): FedosDesktopViewModelState<T> {
  return Object.freeze({ status: "loaded", data });
}

export function fedosViewModelError<T = never>(outcome: string, reason: string): FedosDesktopViewModelState<T> {
  return Object.freeze({ status: "error", outcome, reason });
}

/** Narrow helper — maps ANY `FedosDesktopShellResult<T>` (`{outcome:"ok",value}` | `{outcome,reason}`) onto this file's own closed state shape, verbatim, never re-deriving or widening the Shell's own outcome/reason. */
export function fedosViewModelFromShellResult<T>(result: { readonly outcome: string; readonly value?: T; readonly reason?: string }): FedosDesktopViewModelState<T> {
  if (result.outcome === "ok") return fedosViewModelLoaded(result.value as T);
  return fedosViewModelError(result.outcome, result.reason ?? "");
}
