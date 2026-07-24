/**
 * Secure Runtime Alpha 3561-3640 — Phase D: Safe Response Vocabulary.
 *
 * The ONE closed shape every `FedosDesktopHostPort` method returns.
 * Mirrors `FedosDesktopShellResult<T>`/`FedosDesktopViewModelState<T>`'s
 * own established "closed, coarse outcome" ethos one layer further out —
 * never a raw `Error`, stack trace, persistence record, ciphertext byte,
 * key material, filesystem object, or function/class instance. Every
 * `FedosDesktopHostResponse<T>` is plain, `Object.freeze`d, JSON-safe data
 * (confirmed by a dedicated serialization test) — the ONE thing this
 * layer's own callers (a future IPC boundary, or this Arc's own
 * in-process `FedosDesktopHostBridge`) are allowed to send across any
 * process boundary.
 */

export type FedosDesktopHostDiagnosticCode =
  | "unavailable"
  | "unauthorized"
  | "not-found"
  | "invalid-input"
  | "conflict"
  | "requires-activation"
  | "requires-unlock"
  | "unsupported"
  | "failed"
  | "unknown-command";

export interface FedosDesktopHostFailure {
  readonly outcome: "error";
  readonly code: FedosDesktopHostDiagnosticCode;
  /** Short, closed, non-secret diagnostic -- safe to display or log verbatim, never a raw Error message/stack. */
  readonly message: string;
  /** Present only when the caller supplied one on `dispatch()` -- see `FedosDesktopHostCommand`'s own optional `requestId`. */
  readonly requestId?: string;
}

export interface FedosDesktopHostSuccess<T> {
  readonly outcome: "ok";
  readonly value: T;
  readonly requestId?: string;
}

export type FedosDesktopHostResponse<T> = FedosDesktopHostSuccess<T> | FedosDesktopHostFailure;

export function fedosHostOk<T>(value: T, requestId?: string): FedosDesktopHostResponse<T> {
  return Object.freeze(requestId === undefined ? { outcome: "ok", value } : { outcome: "ok", value, requestId });
}

export function fedosHostFailure<T = never>(code: FedosDesktopHostDiagnosticCode, message: string, requestId?: string): FedosDesktopHostResponse<T> {
  return Object.freeze(requestId === undefined ? { outcome: "error", code, message } : { outcome: "error", code, message, requestId });
}

/** Maps ANY closed `{outcome:"ok",value}|{outcome,reason}`-shaped result (`FedosDesktopShellResult`'s own exact shape) onto this file's own vocabulary verbatim -- never re-deriving or widening the underlying outcome/reason. */
export function fedosHostResponseFromResult<T>(
  result: { readonly outcome: string; readonly value?: T; readonly reason?: string },
  requestId?: string,
): FedosDesktopHostResponse<T> {
  if (result.outcome === "ok") return fedosHostOk(result.value as T, requestId);
  return fedosHostFailure(result.outcome as FedosDesktopHostDiagnosticCode, result.reason ?? "", requestId);
}

/** Maps ANY `FedosDesktopViewModelState<T>`-shaped state (`{status:"idle"|"loading"} | {status:"loaded",data} | {status:"error",outcome,reason}` -- `../presentation/fedos_desktop_view_model_state.ts`'s own exact shape) onto this file's own vocabulary. `"idle"`/`"loading"` collapse to `"unavailable"` here -- a Host caller's `dispatch()` always awaits the FULL action to settle (never observes a mid-flight ViewModel from THIS entry point; `"loading"` is only ever observable by a caller reading `render()` concurrently, a separate, already-safe path), so an `"idle"`/`"loading"` state reaching a dispatch response would mean the underlying action never genuinely resolved -- an honest, closed `"unavailable"`, never fabricated content. */
export function fedosHostResponseFromViewModelState<T>(
  state: { readonly status: "idle" | "loading" } | { readonly status: "loaded"; readonly data: T } | { readonly status: "error"; readonly outcome: string; readonly reason: string },
  requestId?: string,
): FedosDesktopHostResponse<T> {
  if (state.status === "loaded") return fedosHostOk(state.data, requestId);
  if (state.status === "error") return fedosHostFailure(state.outcome as FedosDesktopHostDiagnosticCode, state.reason, requestId);
  return fedosHostFailure("unavailable", `ViewModel action did not settle (status: ${state.status})`, requestId);
}
