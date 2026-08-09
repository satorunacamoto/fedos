/**
 * Secure Runtime Alpha 5401-5480 — Phase D/H: closed capability/readiness
 * reporting for the Direct Ratchet State Runtime. Mirrors this
 * codebase's own "closed outcome, not a bare boolean" discipline
 * (e.g. `FedosWasmLoaderDecision`, `FedosDeviceTrustState`).
 */
import type { FedosDirectRatchetSessionLifecycleState } from "../../../../conversation/ratchet/fedos_direct_ratchet_session_lifecycle.js";

export type FedosDirectRatchetReadinessState =
  | "ready"
  | "sealing-authority-unavailable"
  | "session-not-found"
  | "session-not-active"
  | "runtime-stopped";

export interface FedosDirectRatchetReadiness {
  readonly state: FedosDirectRatchetReadinessState;
  readonly lifecycleState: FedosDirectRatchetSessionLifecycleState | null;
}

export function fedosDirectRatchetReadinessIsReady(readiness: FedosDirectRatchetReadiness): boolean {
  return readiness.state === "ready";
}
