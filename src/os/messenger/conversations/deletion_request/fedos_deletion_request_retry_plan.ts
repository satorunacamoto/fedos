/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Expiry/Retry Planner.
 *
 * Phase L — a PURE function over durable facts (this Arc's own
 * `FedosPersistedDeletionRequestStateRecordV1`) plus a caller-supplied
 * clock. No timer is started here (this Arc has no live delivery to
 * schedule) — a future transport Arc calls this planner each time it
 * considers retrying, exactly like `FedosPublishScheduler`'s own
 * `tick()` already calls a real abandonment policy per real attempt
 * (`b3b3a6d`'s own Outbox precedent, reused in SHAPE, never imported).
 *
 * Concrete defaults are this Arc's own adoption of the review's own
 * PROPOSED numbers (`860a58e`, Doc 10) — no existing constant in this
 * codebase supplies them.
 */

import type { FedosDeletionRequestLifecycleState } from "./fedos_deletion_request_lifecycle_state.js";
import type { FedosPersistedDeletionRequestStateRecordV1 } from "./fedos_persisted_deletion_request_state_record_v1.js";

/** PROPOSED (review Doc 10) — 8 attempts, 1h/2h/4h/8h/16h/24h/24h/24h backoff (hours, converted to seconds below). */
export const FEDOS_DELETION_REQUEST_MAX_RETRY_ATTEMPTS = 8;
export const FEDOS_DELETION_REQUEST_BACKOFF_SCHEDULE_SECONDS: readonly number[] = [1, 2, 4, 8, 16, 24, 24, 24].map((hours) => hours * 60 * 60);

const TERMINAL_LIFECYCLE_STATES: ReadonlySet<FedosDeletionRequestLifecycleState> = new Set(["acknowledged", "expired", "rejected", "failed", "cancelled"]);

export type FedosDeletionRequestRetryAction =
  | { readonly action: "retry"; readonly nextRetryAt: number; readonly remainingAttempts: number }
  | { readonly action: "expire" }
  | { readonly action: "terminal" }
  | { readonly action: "device-revoked" };

export interface FedosDeletionRequestRetryPlanInput {
  readonly snapshot: FedosPersistedDeletionRequestStateRecordV1;
  readonly now: number;
  /** `true` if this Arc's own LOCAL knowledge (e.g. `FedosSyncDeviceRegistry`) shows the recipient Device this request names is currently revoked — advisory only (Doc 08), never cryptographically proven. */
  readonly recipientDeviceKnownRevoked: boolean;
}

/**
 * `"retry after terminal rejection"` never happens: a `snapshot` whose
 * own `lifecycleState` is already terminal always returns `"terminal"`,
 * regardless of `now`/attempts — the ONLY way to continue past a
 * terminal outcome is a brand-new logical request with a new
 * `requestId` (Doc 06), never a produced-by-this-planner retry.
 */
export function planFedosDeletionRequestRetry(input: FedosDeletionRequestRetryPlanInput): FedosDeletionRequestRetryAction {
  const { snapshot, now, recipientDeviceKnownRevoked } = input;

  if (TERMINAL_LIFECYCLE_STATES.has(snapshot.lifecycleState)) return { action: "terminal" };
  if (recipientDeviceKnownRevoked) return { action: "device-revoked" };
  if (now >= snapshot.expiresAt) return { action: "expire" };
  if (snapshot.retryCount >= FEDOS_DELETION_REQUEST_MAX_RETRY_ATTEMPTS) return { action: "expire" };

  // Cumulative sum of the schedule's own first (retryCount + 1) entries -- e.g. after 2 prior
  // attempts (retryCount === 2), the third retry fires at issuedAt + (1h + 2h + 4h), never
  // `backoffSeconds * attemptNumber` (which would be wrong for a non-uniform schedule).
  let cumulativeSeconds = 0;
  for (let i = 0; i <= snapshot.retryCount && i < FEDOS_DELETION_REQUEST_BACKOFF_SCHEDULE_SECONDS.length; i += 1) {
    cumulativeSeconds += FEDOS_DELETION_REQUEST_BACKOFF_SCHEDULE_SECONDS[i]!;
  }
  const nextRetryAt = Math.min(snapshot.issuedAt + cumulativeSeconds, snapshot.expiresAt);

  return { action: "retry", nextRetryAt, remainingAttempts: FEDOS_DELETION_REQUEST_MAX_RETRY_ATTEMPTS - snapshot.retryCount };
}
