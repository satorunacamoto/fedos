/**
 * Secure Runtime Alpha 5401-5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") — Deletion Status Vocabulary.
 *
 * A closed, versioned, fifteen-value LOCAL deletion-status vocabulary,
 * mapped directly onto the existing, shipped `FedosPayloadDeletionMeaning`
 * (Alpha 792, `../retention/fedos_payload_retention_state.ts`) — this Arc
 * extends, never replaces, that vocabulary, per the normative review's own
 * `16_user_visible_status_and_warnings.md` §2 mapping (read via
 * `git show cf5b870:...`, not merged into this branch).
 *
 * Narrowed from the review's own nineteen-value model to this Arc's
 * LOCAL-only scope: `remote-request-sent`, `remote-request-acknowledged`,
 * `recipient-claims-deleted`, and `relay-claims-deleted` are excluded
 * outright (no remote request or Relay interaction exists anywhere in
 * this Arc). `deletion-requested` is retained with a LOCAL meaning only —
 * a local user has requested deletion and a plan has been recorded, not
 * yet executed (§ below) — never a remote request.
 *
 * BINDING, restated from the normative review's own floor: a message's
 * deletion state is always a SET of `{ target, status }` pairs (one per
 * `FedosDeletionTarget`), never a single field on a message record — see
 * `fedos_deletion_assessment.ts`. No status combination is ever presented
 * to a user as "deleted everywhere" — see `fedos_deletion_non_guarantees.ts`.
 */

import type { FedosPayloadDeletionMeaning } from "../retention/fedos_payload_retention_state.js";

export type FedosDeletionStatus =
  | "present"
  | "deletion-requested"
  | "locally-hidden"
  | "locally-tombstoned"
  | "local-payload-deleted"
  | "local-index-deleted"
  | "local-cache-deleted"
  | "local-archive-retained"
  | "local-backup-retained"
  | "access-revoked"
  | "cryptographically-inaccessible"
  | "partially-deleted"
  | "unsupported"
  | "failed"
  | "unverifiable";

export const FEDOS_DELETION_STATUSES: readonly FedosDeletionStatus[] = [
  "present",
  "deletion-requested",
  "locally-hidden",
  "locally-tombstoned",
  "local-payload-deleted",
  "local-index-deleted",
  "local-cache-deleted",
  "local-archive-retained",
  "local-backup-retained",
  "access-revoked",
  "cryptographically-inaccessible",
  "partially-deleted",
  "unsupported",
  "failed",
  "unverifiable",
];

const FEDOS_DELETION_STATUS_SET: ReadonlySet<string> = new Set(FEDOS_DELETION_STATUSES);

export function isFedosDeletionStatus(value: unknown): value is FedosDeletionStatus {
  return typeof value === "string" && FEDOS_DELETION_STATUS_SET.has(value);
}

/**
 * One `{ target, status }` observation — never a bare status, never a bare
 * boolean. A full deletion summary for one payload is a readonly array of
 * these, one per target this Arc actually assessed.
 */
export interface FedosDeletionStatusObservation {
  readonly target: import("./fedos_deletion_target.js").FedosDeletionTarget;
  readonly status: FedosDeletionStatus;
}

/**
 * Maps the existing, shipped `FedosPayloadDeletionMeaning` (Alpha 792) onto
 * this Arc's own `FedosDeletionStatus` for the `local-payload`/
 * `local-envelope` targets — restates the normative review's own
 * `16_user_visible_status_and_warnings.md` §2 table exactly, including its
 * three deliberate renames (`cryptographically-erased` ->
 * `cryptographically-inaccessible`; `remotely-deleted` has no local
 * status at all, since this Arc never claims it; `removed-from-backup` ->
 * inverted into `local-backup-retained`, which this function does not
 * derive from a `FedosPayloadDeletionMeaning` value at all — it is always
 * asserted directly by the assessment/plan layer, per the review's own
 * §5 finding that the HONEST default deserves the first-class label).
 * Returns `null` for a meaning this Arc's local model does not surface as
 * a status at all (`compacted-from-active-log` — internal Archive
 * bookkeeping, never user-facing; `remotely-deleted` — no remote
 * mechanism exists; `removed-from-backup` — this Arc never removes a
 * backup, so this meaning never has a real local status to map to).
 */
export function fedosDeletionStatusFromPayloadDeletionMeaning(meaning: FedosPayloadDeletionMeaning): FedosDeletionStatus | null {
  switch (meaning) {
    case "application-hidden":
      return "locally-hidden";
    case "logically-tombstoned":
      return "locally-tombstoned";
    case "local-payload-removed":
      return "local-payload-deleted";
    case "access-revoked":
      return "access-revoked";
    case "cryptographically-erased":
      return "cryptographically-inaccessible";
    case "compacted-from-active-log":
    case "remotely-deleted":
    case "removed-from-backup":
      return null;
  }
}
