/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Structural Validation (Phase G, steps 1-4).
 *
 * Steps 5-12 (signature, replay, Conversation/target/authorship,
 * Membership, recipient binding, capability compatibility) are
 * `fedos_deletion_request_authorization_assessment.ts`'s own job — this
 * file checks ONLY what a request's own bytes can prove about
 * themselves, with no external dependency and no I/O.
 *
 * Concrete bounds are this Arc's own adoption of the normative review's
 * PROPOSED defaults (`860a58e`, Doc 10) — no existing constant in this
 * codebase supplies them.
 */

import { isWellFormedFedosDeletionRequestRecordV1, type FedosDeletionRequestRecordV1 } from "./fedos_deletion_request_record.js";

/** PROPOSED (review Doc 10) — 14 days, in seconds. */
export const FEDOS_DELETION_REQUEST_MAX_LIFETIME_SECONDS = 14 * 24 * 60 * 60;
/** PROPOSED (review Doc 10) — ±5 minutes, in seconds. */
export const FEDOS_DELETION_REQUEST_CLOCK_SKEW_TOLERANCE_SECONDS = 5 * 60;

export type FedosDeletionRequestStructuralValidationOutcome =
  | "well-formed"
  | "malformed"
  | "lifetime-exceeded"
  | "issued-in-future";

/**
 * Steps 1-4: structural/schema (`isWellFormedFedosDeletionRequestRecordV1`),
 * limits (max lifetime), canonical identifier (already checked inside
 * the schema validator), timestamp/expiry (clock skew on `issuedAt`).
 * Pure, never throws. `now` is caller-supplied (this codebase's own
 * `clock?: () => number` convention) — never `Date.now()` internally.
 */
export function validateFedosDeletionRequestRecordV1Structure(
  candidate: unknown,
  now: number,
): FedosDeletionRequestStructuralValidationOutcome {
  if (!isWellFormedFedosDeletionRequestRecordV1(candidate)) return "malformed";
  const record: FedosDeletionRequestRecordV1 = candidate;

  if (record.issuedAt > now + FEDOS_DELETION_REQUEST_CLOCK_SKEW_TOLERANCE_SECONDS) return "issued-in-future";
  if (record.expiresAt - record.issuedAt > FEDOS_DELETION_REQUEST_MAX_LIFETIME_SECONDS) return "lifetime-exceeded";

  return "well-formed";
}
