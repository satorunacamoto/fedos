/**
 * Secure Runtime Alpha 5401-5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") — Deletion Evidence Vocabulary.
 *
 * A closed, versioned vocabulary of how strongly this Arc can vouch that
 * an operation actually happened, derived from the normative review's own
 * evidence model (`03_secret_capability_model.md` §2.3), narrowed to this
 * Arc's own LOCAL-only scope: the review's own `peer-claimed`,
 * `relay-claimed`, and `cryptographically-proven` levels all describe
 * remote or key-lifecycle evidence this Arc never produces (no remote
 * request exists to claim anything about, and no key-rotation mechanism
 * exists anywhere in this codebase) — they are not included, not even as
 * inert vocabulary.
 *
 * `"local-verified"` is reserved for an operation this Arc's own process
 * can RE-QUERY and confirm absence for (the Search index's
 * `removeEnvelope()` qualifies, per the review's own §06 finding).
 * `"local-observed"` is an operation that ran and reported success
 * without an independent re-check (e.g. a Retention transition's own
 * decision record, or a best-effort memory clear). `"unverifiable"` names
 * an operation this Arc attempted but has no way to confirm.
 */

export type FedosDeletionEvidence = "none" | "local-observed" | "local-verified" | "unverifiable";

export const FEDOS_DELETION_EVIDENCE_LEVELS: readonly FedosDeletionEvidence[] = [
  "none",
  "local-observed",
  "local-verified",
  "unverifiable",
];

const FEDOS_DELETION_EVIDENCE_SET: ReadonlySet<string> = new Set(FEDOS_DELETION_EVIDENCE_LEVELS);

export function isFedosDeletionEvidence(value: unknown): value is FedosDeletionEvidence {
  return typeof value === "string" && FEDOS_DELETION_EVIDENCE_SET.has(value);
}
