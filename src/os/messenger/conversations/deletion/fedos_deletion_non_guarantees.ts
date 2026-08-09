/**
 * Secure Runtime Alpha 5401-5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") — Non-Guarantee Vocabulary.
 *
 * Phase N — a closed, versioned vocabulary of the warnings/limitations
 * this Arc's own assessment, plan, execution, and user-safe-view layers
 * are ALLOWED to attach — never free text, so a caller cannot
 * accidentally soften or omit one of these by re-wording it. Every code
 * restates a finding from the normative review's own twelve-item
 * non-guarantee list (`17_threat_model_and_non_guarantees.md` §2, read via
 * `git show cf5b870:...`, not merged into this branch), narrowed to what
 * is actually reachable from this Arc's own LOCAL-only scope.
 *
 * `fedosDeletionApplicableNonGuarantees(target)` is the single place that
 * decides which warnings apply to a given target — every other module in
 * this Arc (assessment, plan, execution, summary) calls this rather than
 * hand-picking warnings itself, so the applicable set can never silently
 * drift out of sync across those layers.
 */

import type { FedosDeletionTarget } from "../../../../conversation/deletion/fedos_deletion_target.js";

export type FedosDeletionNonGuaranteeCode =
  | "no-remote-erasure"
  | "no-relay-deletion"
  | "no-physical-erasure"
  | "no-secure-wipe"
  | "backup-may-remain"
  | "remote-device-may-remain"
  | "no-deleted-everywhere";

export const FEDOS_DELETION_NON_GUARANTEE_CODES: readonly FedosDeletionNonGuaranteeCode[] = [
  "no-remote-erasure",
  "no-relay-deletion",
  "no-physical-erasure",
  "no-secure-wipe",
  "backup-may-remain",
  "remote-device-may-remain",
  "no-deleted-everywhere",
];

const FEDOS_DELETION_NON_GUARANTEE_SET: ReadonlySet<string> = new Set(FEDOS_DELETION_NON_GUARANTEE_CODES);

export function isFedosDeletionNonGuaranteeCode(value: unknown): value is FedosDeletionNonGuaranteeCode {
  return typeof value === "string" && FEDOS_DELETION_NON_GUARANTEE_SET.has(value);
}

/**
 * Fixed, non-affirmative human text for each code — every sentence here
 * NAMES a limitation; none affirms erasure, wiping, or "everywhere"
 * (checked directly by this Arc's own structural-proof test suite).
 */
export const FEDOS_DELETION_NON_GUARANTEE_TEXT: Readonly<Record<FedosDeletionNonGuaranteeCode, string>> = {
  "no-remote-erasure": "This Arc sends no remote deletion request of any kind — no other endpoint is asked to do anything.",
  "no-relay-deletion": "No Relay deletion mechanism exists in this codebase; any ciphertext already published to a relay is untouched by this action.",
  "no-physical-erasure": "Physical erasure of already-written bytes (disk sectors, SSD wear-leveled blocks) is never guaranteed or claimed.",
  "no-secure-wipe": "No secure-wipe or zero-trace guarantee is made; memory zeroization, where it runs, is best-effort only.",
  "backup-may-remain": "Any separate backup, filesystem snapshot, or cloud-sync copy is not affected by this action.",
  "remote-device-may-remain": "Another device that already synced or received this content keeps its own local copy, unaffected by this action.",
  "no-deleted-everywhere": "No combination of local statuses is ever presented as \"deleted everywhere.\"",
};

/**
 * The applicable non-guarantee codes for one `FedosDeletionTarget` — the
 * single source every other layer in this Arc reuses.
 * `"no-deleted-everywhere"` applies universally (Phase N's own binding
 * floor), so it is not itemized per target below; callers building a
 * full user-facing summary should always include it once, separately.
 */
export function fedosDeletionApplicableNonGuarantees(target: FedosDeletionTarget): readonly FedosDeletionNonGuaranteeCode[] {
  switch (target) {
    case "local-payload":
    case "local-envelope":
      return ["no-remote-erasure", "no-relay-deletion", "no-physical-erasure", "backup-may-remain", "remote-device-may-remain"];
    case "local-index":
    case "local-cache":
      return ["no-physical-erasure"];
    case "local-archive-file":
    case "local-incremental-archive-file":
      return ["no-physical-erasure", "backup-may-remain"];
    case "local-notification-preview":
      return [];
    case "memory-reference":
      return ["no-secure-wipe"];
    case "local-device-access":
    case "local-membership-access":
      return ["remote-device-may-remain"];
  }
}
