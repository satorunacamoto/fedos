/**
 * Secure Runtime Alpha 5401-5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") — Deletion Target Vocabulary.
 *
 * A closed, versioned vocabulary of the LOCAL domains this Arc can
 * honestly represent as an executable deletion target, derived from the
 * normative review (`cf5b870`,
 * `docs/reviews/fedos_secret_capability_deletion_v1/03_secret_capability_model.md`
 * §2.1, read via `git show`, not merged into this branch) and narrowed to
 * this Arc's own Phase B scope: LOCAL targets only.
 *
 * The review's own broader model additionally names four REMOTE targets
 * (`remote-device-copy`, `recipient-copy`, `relay-copy`, plus the
 * cross-cutting `log-copy`/`attachment-copy` slots) — this Arc's own
 * Absolute Prohibitions forbid implementing a remote deletion request, a
 * wire protocol, or Relay deletion, so none of those four is included
 * here, not even as an inert variant: this type is executable-target
 * vocabulary, and this Arc makes no remote-erasure claim of any kind (see
 * `fedos_deletion_non_guarantees.ts`).
 *
 * `local-incremental-archive-file` and `local-notification-preview` are
 * named for vocabulary completeness even though this base has zero real
 * producer for either today (Phase A reconciliation report §2/§3) — the
 * same "named but honestly unsupported" discipline
 * `FedosPayloadDeletionMeaning` (Alpha 792) already established for its
 * own five non-V1-enforceable meanings.
 */

export type FedosDeletionTarget =
  | "memory-reference"
  | "local-payload"
  | "local-envelope"
  | "local-index"
  | "local-cache"
  | "local-archive-file"
  | "local-incremental-archive-file"
  | "local-notification-preview"
  | "local-device-access"
  | "local-membership-access";

export const FEDOS_DELETION_TARGETS: readonly FedosDeletionTarget[] = [
  "memory-reference",
  "local-payload",
  "local-envelope",
  "local-index",
  "local-cache",
  "local-archive-file",
  "local-incremental-archive-file",
  "local-notification-preview",
  "local-device-access",
  "local-membership-access",
];

const FEDOS_DELETION_TARGET_SET: ReadonlySet<string> = new Set(FEDOS_DELETION_TARGETS);

/** Strict membership check — never widened by string coercion. Any value this returns `false` for fails closed at every call site in this Arc. */
export function isFedosDeletionTarget(value: unknown): value is FedosDeletionTarget {
  return typeof value === "string" && FEDOS_DELETION_TARGET_SET.has(value);
}
