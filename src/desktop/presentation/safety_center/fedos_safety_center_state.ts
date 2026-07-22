/**
 * Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and
 * Safety Center Arc) — Phase B: the closed Safety Center composition model.
 *
 * This is a UI-layer AGGREGATION domain only — it owns no crypto,
 * persistence, or transport of its own. Every fact rendered here is
 * traceable to an already-real Shell/Runtime accessor (see
 * `fedos_safety_center_summary.ts`'s own header). Never a single numeric
 * "security score" — each section has its OWN closed state, independent of
 * every other section's.
 */

/** The 13 top-level sections named in the mission, plus nothing else — this union is exhaustive and closed. */
export type FedosSafetyCenterSection =
  | "overview"
  | "profile-and-unlock"
  | "devices"
  | "device-sync"
  | "secure-messaging"
  | "peer-capabilities"
  | "identity-replacement"
  | "deletion-requests"
  | "retention-and-search"
  | "archive-and-backups"
  | "notifications-and-background"
  | "security-events"
  | "limitations";

export const FEDOS_SAFETY_CENTER_SECTIONS: readonly FedosSafetyCenterSection[] = [
  "overview",
  "profile-and-unlock",
  "devices",
  "device-sync",
  "secure-messaging",
  "peer-capabilities",
  "identity-replacement",
  "deletion-requests",
  "retention-and-search",
  "archive-and-backups",
  "notifications-and-background",
  "security-events",
  "limitations",
];

export function isFedosSafetyCenterSection(candidate: unknown): candidate is FedosSafetyCenterSection {
  return typeof candidate === "string" && (FEDOS_SAFETY_CENTER_SECTIONS as readonly string[]).includes(candidate);
}

/**
 * Phase B's own closed per-section state vocabulary. `"blocked"` means a
 * real, actionable local obstruction exists (e.g. profile locked);
 * `"unavailable"` means the underlying Runtime/sub-Runtime is simply not
 * configured in this build — never conflated with `"blocked"`, since one is
 * the user's own state and the other is a build/configuration fact.
 * `"attention"` is informational (something worth looking at, not wrong);
 * `"warning"` is a real, honest concern (e.g. a conflicting Identity
 * Replacement, a revoked Device). Never a single boolean "safe/unsafe".
 */
export type FedosSafetyCenterSectionState = "loading" | "ready" | "attention" | "warning" | "blocked" | "unavailable" | "error";

export interface FedosSafetyCenterSectionSummary {
  readonly section: FedosSafetyCenterSection;
  readonly state: FedosSafetyCenterSectionState;
  /** A short, human-safe reason — never a raw error/exception message, never a secret. */
  readonly reason: string | null;
}
