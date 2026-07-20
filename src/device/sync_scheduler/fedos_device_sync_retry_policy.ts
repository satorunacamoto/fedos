/**
 * Secure Runtime Alpha 3721–3800 ("Background Device Sync Scheduling and
 * Conflict Resolution") — Retry Policy (Phase G).
 *
 * A closed, protocol-neutral retry directive — mirrors
 * `FedosConversationTransportPublishResult.retryPolicy`'s own
 * `"immediate"|"later"|"never"` vocabulary (Alpha 1471–1540, unmodified),
 * extended with ONE new value, `"operator-required"`, for the outcomes
 * this Arc's own richer classification names that neither "retry" nor
 * "abandon silently" honestly describes (Phase L).
 *
 * Classification is a PURE, deterministic table over the coarse outcome
 * strings this Arc's own attempt boundary
 * (`fedos_device_sync_scheduler.ts`) already returns — never a new
 * cryptographic/network judgment of its own. This file invents no
 * arbitrary universal retry COUNT: `FedosDeviceSyncAbandonmentPolicy` is
 * an explicit, INJECTED policy a caller supplies (Phase G's own "require
 * explicit injected policy" instruction) — this file has no hardcoded
 * default of its own beyond the classification table.
 */

export type FedosDeviceSyncRetryDirective = "immediate" | "later" | "never" | "operator-required";

/**
 * The closed set of coarse outcome strings this Arc's own Scheduler
 * attempt boundary (`FedosDeviceSyncAttemptFn`, `fedos_device_sync_scheduler.ts`)
 * and Import Coordinator (`fedos_device_sync_import_coordinator.ts`) can
 * produce — reusing the EXISTING Relay Sync (Alpha 3641–3720) and Transfer
 * (Alpha 3481–3560) outcome vocabularies verbatim, never inventing a
 * parallel one.
 */
export type FedosDeviceSyncAttemptOutcomeCode =
  | "delivered"
  | "relay-timeout"
  | "relay-disconnected"
  | "target-unavailable"
  | "crypto-temporarily-unavailable"
  | "revoked-source"
  | "revoked-target"
  | "invalid-signature"
  | "tampered-package"
  | "expired-transfer"
  | "disallowed-record"
  | "route-rejected-permanent"
  | "identity-conflict"
  | "failed";

const RETRYABLE_LATER: ReadonlySet<FedosDeviceSyncAttemptOutcomeCode> = new Set([
  "relay-timeout",
  "relay-disconnected",
  "target-unavailable",
  "crypto-temporarily-unavailable",
]);

const TERMINAL_NEVER: ReadonlySet<FedosDeviceSyncAttemptOutcomeCode> = new Set([
  "revoked-source",
  "revoked-target",
  "invalid-signature",
  "tampered-package",
  "expired-transfer",
  "disallowed-record",
  "route-rejected-permanent",
]);

/**
 * Classifies one coarse attempt outcome into a retry directive.
 * `"identity-conflict"`/unrecognized values map to `"operator-required"` —
 * a Scheduler never silently abandons something it cannot confidently
 * classify as either safely retryable or genuinely terminal.
 */
export function classifyFedosDeviceSyncRetryDirective(outcome: FedosDeviceSyncAttemptOutcomeCode): FedosDeviceSyncRetryDirective {
  if (outcome === "delivered") return "never"; // terminal success -- nothing left to retry.
  if (RETRYABLE_LATER.has(outcome)) return "later";
  if (TERMINAL_NEVER.has(outcome)) return "never";
  return "operator-required";
}

export interface FedosDeviceSyncAbandonmentPolicy {
  /** Strictly positive integer -- the Nth "later" attempt (inclusive) after which the Scheduler stops retrying and requires operator attention instead. */
  readonly maxAttempts: number;
  /** Whole seconds added to `now` for the next eligible retry after a `"later"` outcome. */
  readonly laterDelaySeconds: number;
}

export function isWellFormedFedosDeviceSyncAbandonmentPolicy(policy: FedosDeviceSyncAbandonmentPolicy): boolean {
  return (
    Number.isInteger(policy.maxAttempts) &&
    policy.maxAttempts > 0 &&
    Number.isInteger(policy.laterDelaySeconds) &&
    policy.laterDelaySeconds > 0
  );
}
