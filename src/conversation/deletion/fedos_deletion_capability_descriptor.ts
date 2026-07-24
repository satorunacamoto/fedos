/**
 * Secure Runtime Alpha 5401-5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") — Deletion Capability Descriptor.
 *
 * Phase C — `FedosDeletionCapabilityDescriptor`, one per
 * `FedosDeletionTarget`, derived ENTIRELY from this Arc's own Phase A
 * reconciliation report (`docs/secure_runtime_alpha_5401_5480_reconciliation_report.md`)
 * — a caller-supplied target string is looked up in a fixed, static
 * registry; a caller can never self-declare a capability
 * (`FedosDeletionCapabilityDescriptor` is never accepted as an argument
 * anywhere in this Arc's own API surface, only ever returned). An unknown
 * target string fails closed to `null`, never a synthesized descriptor.
 *
 * `localSupport: false` for `local-cache`, `local-incremental-archive-file`,
 * and `local-notification-preview` restates this Arc's own Phase A
 * finding: no dedicated cache eviction, no merged incremental-Archive
 * lineage, and no persisted notification-preview content exists anywhere
 * on this Arc's own base — never invented here to make the vocabulary
 * "feel" complete.
 */

import { type FedosDeletionTarget, isFedosDeletionTarget } from "./fedos_deletion_target.js";
import type { FedosDeletionOperation } from "./fedos_deletion_operation.js";
import type { FedosDeletionEvidence } from "./fedos_deletion_evidence.js";

/** Closed, versioned limitation codes — never free text, so a UI cannot accidentally invent an overclaiming phrase. */
export type FedosDeletionLimitationCode =
  | "none"
  | "best-effort-only"
  | "logical-only-bytes-may-remain"
  | "file-removal-not-physical-erasure"
  | "revocation-is-forward-only"
  | "not-implemented";

export interface FedosDeletionCapabilityDescriptor {
  readonly schemaVersion: 1;
  readonly target: FedosDeletionTarget;
  /** Every operation this target has a REAL producer for today. Empty if none. */
  readonly supportedOperations: readonly FedosDeletionOperation[];
  /** The strongest evidence level this target's real operation(s) can produce. */
  readonly evidenceClass: FedosDeletionEvidence;
  readonly requiresExplicitConfirmation: boolean;
  readonly idempotent: boolean;
  readonly reversible: boolean;
  readonly mayRetainBackups: boolean;
  readonly mayRetainRemoteCopies: boolean;
  readonly userVisibleLimitationCode: FedosDeletionLimitationCode;
  /** Does THIS build implement at least one operation for this target at all? */
  readonly localSupport: boolean;
  /** Is it wired to a real production entry point through this Arc's own coordinator (vs. named-but-conceptual only)? */
  readonly reachableToday: boolean;
}

function descriptor(fields: Omit<FedosDeletionCapabilityDescriptor, "schemaVersion">): FedosDeletionCapabilityDescriptor {
  return { schemaVersion: 1, ...fields };
}

/**
 * The fixed, static registry — never constructed from caller input.
 * Every row is directly traceable to a Phase A reconciliation-report
 * finding; see that document for the source-grounded justification this
 * file's own comments only summarize.
 */
const FEDOS_DELETION_CAPABILITY_REGISTRY: Readonly<Record<FedosDeletionTarget, FedosDeletionCapabilityDescriptor>> = {
  "memory-reference": descriptor({
    target: "memory-reference",
    supportedOperations: ["forget-reference"],
    evidenceClass: "none",
    requiresExplicitConfirmation: false,
    idempotent: true,
    reversible: false,
    mayRetainBackups: true,
    mayRetainRemoteCopies: true,
    userVisibleLimitationCode: "best-effort-only",
    localSupport: true,
    reachableToday: false,
  }),
  "local-payload": descriptor({
    target: "local-payload",
    supportedOperations: ["tombstone", "logical-delete"],
    evidenceClass: "local-observed",
    requiresExplicitConfirmation: true,
    idempotent: true,
    reversible: false,
    mayRetainBackups: true,
    mayRetainRemoteCopies: true,
    userVisibleLimitationCode: "logical-only-bytes-may-remain",
    localSupport: true,
    reachableToday: true,
  }),
  /**
   * Secure Runtime Alpha 7481-7560 (FedOS Archive Envelope Retention
   * Parity and Metadata Deletion Semantics Arc) — CORRECTED. A committed
   * audit (`2eed88d9`) and this Arc's own Phase A reconciliation
   * independently confirmed this entry previously overclaimed
   * `reachableToday: true` with real `supportedOperations` — but no live
   * Envelope delete method, plan-step, or executor exists anywhere in
   * this codebase (`fedos_deletion_plan.ts`'s own `target` union
   * structurally supports only `"local-payload"`/`"local-index"`;
   * `executeFedosLocalPayloadDeletionPlan()` never touches Envelope
   * persistence). The live Envelope record survives every local
   * deletion by design (Alpha 854/858) — there is nothing to tombstone.
   * This Arc's own real fix operates at the ARCHIVE layer only (export/
   * restore parity, see `fedos_conversation_archive_collector.ts`), never
   * by adding a live Envelope-delete capability — "Fail Closed over
   * fabrication" requires this descriptor to say so honestly.
   */
  "local-envelope": descriptor({
    target: "local-envelope",
    supportedOperations: [],
    evidenceClass: "none",
    requiresExplicitConfirmation: false,
    idempotent: true,
    reversible: false,
    mayRetainBackups: true,
    mayRetainRemoteCopies: true,
    userVisibleLimitationCode: "not-implemented",
    localSupport: false,
    reachableToday: false,
  }),
  "local-index": descriptor({
    target: "local-index",
    supportedOperations: ["purge-index"],
    evidenceClass: "local-verified",
    requiresExplicitConfirmation: false,
    idempotent: true,
    reversible: false,
    mayRetainBackups: true,
    mayRetainRemoteCopies: true,
    userVisibleLimitationCode: "none",
    localSupport: true,
    reachableToday: true,
  }),
  "local-cache": descriptor({
    target: "local-cache",
    supportedOperations: [],
    evidenceClass: "none",
    requiresExplicitConfirmation: false,
    idempotent: true,
    reversible: false,
    mayRetainBackups: true,
    mayRetainRemoteCopies: true,
    userVisibleLimitationCode: "not-implemented",
    localSupport: false,
    reachableToday: false,
  }),
  "local-archive-file": descriptor({
    target: "local-archive-file",
    supportedOperations: ["remove-file"],
    evidenceClass: "local-verified",
    requiresExplicitConfirmation: true,
    idempotent: true,
    reversible: false,
    mayRetainBackups: true,
    mayRetainRemoteCopies: true,
    userVisibleLimitationCode: "file-removal-not-physical-erasure",
    localSupport: true,
    reachableToday: true,
  }),
  "local-incremental-archive-file": descriptor({
    target: "local-incremental-archive-file",
    supportedOperations: [],
    evidenceClass: "none",
    requiresExplicitConfirmation: true,
    idempotent: true,
    reversible: false,
    mayRetainBackups: true,
    mayRetainRemoteCopies: true,
    userVisibleLimitationCode: "not-implemented",
    localSupport: false,
    reachableToday: false,
  }),
  "local-notification-preview": descriptor({
    target: "local-notification-preview",
    supportedOperations: [],
    evidenceClass: "none",
    requiresExplicitConfirmation: false,
    idempotent: true,
    reversible: false,
    mayRetainBackups: true,
    mayRetainRemoteCopies: true,
    userVisibleLimitationCode: "not-implemented",
    localSupport: false,
    reachableToday: false,
  }),
  "local-device-access": descriptor({
    target: "local-device-access",
    supportedOperations: ["revoke-access"],
    evidenceClass: "local-verified",
    requiresExplicitConfirmation: true,
    idempotent: true,
    reversible: false,
    mayRetainBackups: true,
    mayRetainRemoteCopies: true,
    userVisibleLimitationCode: "revocation-is-forward-only",
    localSupport: true,
    reachableToday: true,
  }),
  "local-membership-access": descriptor({
    target: "local-membership-access",
    supportedOperations: ["revoke-access"],
    evidenceClass: "local-verified",
    requiresExplicitConfirmation: true,
    idempotent: true,
    reversible: false,
    mayRetainBackups: true,
    mayRetainRemoteCopies: true,
    userVisibleLimitationCode: "revocation-is-forward-only",
    localSupport: true,
    reachableToday: true,
  }),
};

/** Typed lookup — always succeeds for a real `FedosDeletionTarget`. */
export function getFedosDeletionCapabilityDescriptor(target: FedosDeletionTarget): FedosDeletionCapabilityDescriptor {
  return FEDOS_DELETION_CAPABILITY_REGISTRY[target];
}

/** Untrusted-input lookup — `null` for anything that is not a real, closed `FedosDeletionTarget`. Fails closed; never synthesizes a descriptor for an unknown target. */
export function resolveFedosDeletionCapabilityDescriptor(value: unknown): FedosDeletionCapabilityDescriptor | null {
  if (!isFedosDeletionTarget(value)) return null;
  return getFedosDeletionCapabilityDescriptor(value);
}
