/**
 * Secure Runtime Alpha 5401-5480 — Phase D/I: the closed outcome of a
 * sealed-secret recovery attempt (Runtime facade `recover()`, Phase H).
 * Every failure reason is distinct so a caller can tell "no sealed
 * record exists yet" (`reset-required`/`unavailable`, per this Arc's own
 * "missing sealed record reports reset-required/unavailable" test
 * requirement) apart from "a record exists but authentication failed"
 * (`tamper-or-mismatch`) apart from "the session itself forbids
 * recovery" (`session-revoked`/`session-corrupt`) -- recovery NEVER
 * silently creates replacement secret state on any failure path.
 */
export type FedosDirectRatchetRecoveryOutcome =
  | { readonly outcome: "recovered" }
  | { readonly outcome: "missing"; readonly reason: "no-sealed-record" }
  | { readonly outcome: "rejected"; readonly reason: "tamper-or-mismatch" }
  | { readonly outcome: "rejected"; readonly reason: "session-revoked" }
  | { readonly outcome: "rejected"; readonly reason: "session-corrupt" }
  | { readonly outcome: "rejected"; readonly reason: "sealing-authority-unavailable" }
  | { readonly outcome: "rejected"; readonly reason: "runtime-stopped" };

export function fedosDirectRatchetRecoverySucceeded(outcome: FedosDirectRatchetRecoveryOutcome): boolean {
  return outcome.outcome === "recovered";
}
