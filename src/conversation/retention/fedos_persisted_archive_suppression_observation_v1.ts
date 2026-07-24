/**
 * Secure Runtime Alpha 7721–7800 ("FedOS Archive Multi-Device Suppression
 * Propagation Arc") — Phase E: the persisted wire shape for one
 * suppression observation — either self-authored (this Device's own
 * decision, recorded here so it can be re-sent/audited) or imported
 * (received from another trusted, same-account Device after Phase G
 * validation). Mirrors `FedosPersistedPayloadRetentionDecisionV1`'s own
 * discipline exactly (Alpha 795) — a flat, stable wire shape, `id` is
 * the deterministic `factId` so a durable backend's own idempotent-write
 * semantics key off it directly.
 *
 * `origin`/`evidenceLevel`/`receivedAt` are LOCAL bookkeeping fields —
 * never transmitted as part of the wire fact itself
 * (`fedos_archive_suppression_fact.ts`'s own canonical bytes exclude
 * them); they exist only in THIS device's own durable log, recording
 * what THIS device itself concluded about the fact's provenance.
 *
 * HARD GUARDRAILS:
 *   - `FedosPersistedArchiveSuppressionObservationV1` is the ONLY
 *     type export.
 *   - Plain serializable data only; no secret, no device evidence
 *     signature bytes beyond what Phase D already treats as public
 *     (a signature is not a secret).
 */

export type FedosArchiveSuppressionObservationOrigin = "self" | "imported";

export interface FedosPersistedArchiveSuppressionObservationV1 {
  readonly schemaVersion: 1;
  /** The suppression fact's own deterministic `factId` — see `fedos_archive_suppression_fact.ts`. */
  readonly id: string;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly accountIdentityId: string | null;
  readonly sourceDeviceId: string;
  readonly subjectType: string;
  readonly subjectRef: string;
  readonly suppressionMeaning: string;
  readonly revision: number;
  readonly decidedAt: number;
  readonly nonce: string;
  readonly origin: FedosArchiveSuppressionObservationOrigin;
  /** `"self-authored"` for `origin === "self"`; one of Phase D's real evidence levels for `origin === "imported"`. */
  readonly evidenceLevel: "self-authored" | "account-only" | "device-verified" | "device-evidence-invalid";
  /** Local receipt time — equals `decidedAt` for a self-authored record. */
  readonly receivedAt: number;
}

/** Structural equality over every field — mirrors `fedosPersistedPayloadRetentionDecisionsAreEqual`'s own role. */
export function fedosPersistedArchiveSuppressionObservationsAreEqual(
  a: FedosPersistedArchiveSuppressionObservationV1,
  b: FedosPersistedArchiveSuppressionObservationV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.id === b.id &&
    a.accountAuthority === b.accountAuthority &&
    a.accountPublicIdentifier === b.accountPublicIdentifier &&
    a.accountIdentityId === b.accountIdentityId &&
    a.sourceDeviceId === b.sourceDeviceId &&
    a.subjectType === b.subjectType &&
    a.subjectRef === b.subjectRef &&
    a.suppressionMeaning === b.suppressionMeaning &&
    a.revision === b.revision &&
    a.decidedAt === b.decidedAt &&
    a.nonce === b.nonce &&
    a.origin === b.origin &&
    a.evidenceLevel === b.evidenceLevel &&
    a.receivedAt === b.receivedAt
  );
}
