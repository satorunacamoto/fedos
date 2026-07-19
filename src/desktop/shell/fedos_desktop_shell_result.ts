/**
 * Secure Runtime Alpha 2841–2920 ("Desktop Local Application Shell and
 * Conversation Management Boundary Arc") — Phase D.
 *
 * A single, closed result vocabulary every `FedosDesktopApplicationShell`
 * method returns. Never a raw `Error`, never a backend-specific string
 * beyond a short, non-secret, human-readable `reason` meant for a UI
 * diagnostic line — no stack trace, no provider detail, no key/secret
 * material of any kind.
 *
 * `"unavailable"` in particular is this Arc's own honest terminus for the
 * structural boundary documented in
 * `docs/secure_runtime_alpha_2841_2920_execution_spec.md` Phase A/A6 — it
 * is a real, intentional outcome, not a placeholder for an unwritten case.
 */

export type FedosDesktopShellOutcomeKind =
  | "unavailable"
  | "unauthorized"
  | "not-found"
  | "invalid-input"
  | "conflict"
  | "requires-activation"
  | "requires-unlock"
  | "unsupported"
  | "failed";

export interface FedosDesktopShellFailure {
  readonly outcome: FedosDesktopShellOutcomeKind;
  /** Short, closed, non-secret diagnostic — safe to display or log verbatim. */
  readonly reason: string;
}

export type FedosDesktopShellResult<T> = { readonly outcome: "ok"; readonly value: T } | FedosDesktopShellFailure;

export function fedosDesktopShellOk<T>(value: T): FedosDesktopShellResult<T> {
  return Object.freeze({ outcome: "ok", value });
}

export function fedosDesktopShellFailure<T = never>(outcome: FedosDesktopShellOutcomeKind, reason: string): FedosDesktopShellResult<T> {
  return Object.freeze({ outcome, reason });
}
