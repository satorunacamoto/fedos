/**
 * Secure Runtime Alpha 5401-5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") — Deletion Operation Vocabulary.
 *
 * A closed, versioned vocabulary of the LOCAL operations this Arc can
 * apply to a `FedosDeletionTarget` (`./fedos_deletion_target.ts`),
 * derived from the normative review's own operation model
 * (`03_secret_capability_model.md` §2.2) and narrowed to this Arc's own
 * scope — the review's own `request-delete`/`acknowledge-request` (remote
 * request/acknowledgement) and `cryptographic-erase` (no key-lifecycle
 * mechanism exists anywhere in this codebase, per that review's §13/§17)
 * are excluded outright, never named even as inert vocabulary, matching
 * this Arc's own Absolute Prohibitions.
 */

export type FedosDeletionOperation =
  | "forget-reference"
  | "zeroize-best-effort"
  | "tombstone"
  | "logical-delete"
  | "purge-index"
  | "purge-cache"
  | "remove-file"
  | "revoke-access";

export const FEDOS_DELETION_OPERATIONS: readonly FedosDeletionOperation[] = [
  "forget-reference",
  "zeroize-best-effort",
  "tombstone",
  "logical-delete",
  "purge-index",
  "purge-cache",
  "remove-file",
  "revoke-access",
];

const FEDOS_DELETION_OPERATION_SET: ReadonlySet<string> = new Set(FEDOS_DELETION_OPERATIONS);

export function isFedosDeletionOperation(value: unknown): value is FedosDeletionOperation {
  return typeof value === "string" && FEDOS_DELETION_OPERATION_SET.has(value);
}
