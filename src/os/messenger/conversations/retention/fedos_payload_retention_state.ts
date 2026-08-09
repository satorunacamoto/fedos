/**
 * Secure Runtime Alpha 792 ("Deletion Meaning Vocabulary") / Alpha 794
 * ("Retention State Model") — Stages 2/4 of the Alpha 791–820
 * Conversation Retention & Private Payload Storage Boundary Foundation
 * Arc.
 *
 * Alpha 792 names EIGHT distinct meanings "deleted" can honestly carry
 * — never one generic boolean. This file's own
 * `FEDOS_PAYLOAD_DELETION_MEANINGS_V1_ENFORCEABLE` marks which of the
 * eight this Arc actually enforces; the rest are named for vocabulary
 * completeness/future traceability only — no code anywhere in this Arc
 * claims to implement them:
 *
 *   - `application-hidden` — V1 ENFORCEABLE: `FedosPayloadRetentionAuthority`'s
 *     own gated read (`./fedos_payload_retention_authority.ts`) denies
 *     normal reads for a tombstoned/payload-removed payload.
 *   - `access-revoked` — NOT V1 enforceable: no Membership authority
 *     exists anywhere in this codebase (Alpha 749/816's own confirmed
 *     gap) to revoke access FROM.
 *   - `logically-tombstoned` — V1 ENFORCEABLE: a durable
 *     `FedosPayloadRetentionDecision` record (`./fedos_payload_retention_decision.ts`).
 *   - `local-payload-removed` — V1 ENFORCEABLE, WITH AN HONEST LIMIT:
 *     see `fedos_payload_retention_authority.ts`'s own header for
 *     exactly what this claims and does not claim (an access-state
 *     transition, not a guaranteed physical byte removal from every
 *     possible backend).
 *   - `compacted-from-active-log` — NOT implemented; this Arc's own
 *     Absolute Prohibition forbids automatic compaction outright.
 *   - `cryptographically-erased` — NOT implementable; no encryption/key
 *     lifecycle exists anywhere in this Arc's own scope.
 *   - `remotely-deleted` — NOT implementable; no Publisher/Relay/
 *     federation delivery of private content exists.
 *   - `removed-from-backup` — NOT implementable; no backup system
 *     exists anywhere in this codebase.
 *
 * Alpha 794's own candidate state (`active`/`tombstoned`/
 * `payload-removed`) is adopted AS A SEPARATE FACT the Retention
 * Decision Log records, NOT as a Conversation lifecycle state — this
 * Arc concerns stored PAYLOAD retention only. No `archived`/`closed`
 * Conversation state is introduced (no real producer for one exists —
 * `FedosConversationRecord`, Alpha 745, still deliberately carries no
 * lifecycle field; see `docs/secure_runtime_alpha_745_conversation_record_v1_decision.md`).
 * `payload-removed` is a SEPARATE FACT with its own authority (a
 * `FedosPayloadRetentionDecision` record) rather than a mutable field
 * on any existing record — matching this Arc's own "prefer separate
 * facts if they have independent authority" instruction and this
 * codebase's own established "no mutable deleted boolean" discipline.
 */

export type FedosPayloadDeletionMeaning =
  | "application-hidden"
  | "access-revoked"
  | "logically-tombstoned"
  | "local-payload-removed"
  | "compacted-from-active-log"
  | "cryptographically-erased"
  | "remotely-deleted"
  | "removed-from-backup";

/** Every deletion-meaning label, for documentation/traceability only. */
export const FEDOS_PAYLOAD_DELETION_MEANINGS: readonly FedosPayloadDeletionMeaning[] = [
  "application-hidden",
  "access-revoked",
  "logically-tombstoned",
  "local-payload-removed",
  "compacted-from-active-log",
  "cryptographically-erased",
  "remotely-deleted",
  "removed-from-backup",
];

/** The subset this Arc genuinely enforces — see this file's own header for why each of the other five is excluded. */
export const FEDOS_PAYLOAD_DELETION_MEANINGS_V1_ENFORCEABLE: readonly FedosPayloadDeletionMeaning[] = [
  "application-hidden",
  "logically-tombstoned",
  "local-payload-removed",
];

/**
 * Alpha 794 — a payload's retention state, as OBSERVED from its own
 * Retention Decision history (`./fedos_payload_retention_decision.ts`)
 * — never stored as a mutable field anywhere. `"active"` is the
 * implicit default: the absence of any decision record.
 */
export type FedosPayloadRetentionState = "active" | "tombstoned" | "payload-removed";
