/**
 * FedOS Identity Transition Foundation Arc — Phase J: the durable
 * transition fact.
 *
 * Records ONLY safe, non-secret facts about a transition — mirrors
 * `../ratchet/peer_capability/fedos_ratchet_peer_capability_observation.ts`'s
 * own "public identities + evidence-derived outcome + supersession
 * pointer, never raw evidence/signatures/keys" discipline. This is the
 * unit the append-only persistence layer stores; it is deliberately NOT
 * the same object as `FedosIdentityTransitionRecordV1` (the signed body)
 * — a Fact is the LOCAL, already-evaluated record of what was decided
 * about one transition, not the transition's own claims.
 *
 * HARD GUARDRAILS: no Master Seed, no passphrase, no private key, no raw
 * Device private key, no root/chain/message key, no filesystem path, no
 * message plaintext.
 */
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import { isWellFormedFedosIdentityTransitionId } from "./fedos_identity_transition_id.js";
import { FEDOS_IDENTITY_TRANSITION_KNOWN_EVIDENCE_OUTCOMES, type FedosIdentityTransitionEvidenceOutcome } from "./fedos_identity_transition_evidence_evaluation.js";

export type FedosIdentityTransitionFactConflictState = "none" | "conflicting" | "rollback-detected";

export const FEDOS_IDENTITY_TRANSITION_KNOWN_FACT_CONFLICT_STATES: readonly FedosIdentityTransitionFactConflictState[] = Object.freeze([
  "none",
  "conflicting",
  "rollback-detected",
]);

export interface FedosIdentityTransitionFactV1 {
  readonly schemaVersion: 1;
  readonly transitionId: string;
  readonly bodyHash: string;
  readonly oldAccountIdentity: FedosDeviceBindingAccountRef;
  readonly newAccountIdentity: FedosDeviceBindingAccountRef;
  readonly oldNostrIdentity: string;
  readonly newNostrIdentity: string;
  readonly revision: number;
  readonly previousTransitionId: string | null;
  readonly evidenceOutcome: FedosIdentityTransitionEvidenceOutcome;
  readonly conflictState: FedosIdentityTransitionFactConflictState;
  readonly supersededByTransitionId: string | null;
  readonly recordedAt: number;
}

/** Keyed by `transitionId` alone — mirrors the Session Reset record's "keyed by nonce alone" discipline. */
export function fedosIdentityTransitionFactKey(fact: FedosIdentityTransitionFactV1): string {
  return fact.transitionId;
}

/** The lineage a fact belongs to — one lineage per OLD identity being replaced. Competing/rollback/predecessor-chain checks are scoped to one lineage (`fedos_identity_transition_fact_conflict_detection.ts`). */
export function fedosIdentityTransitionLineageKey(fact: FedosIdentityTransitionFactV1): string {
  return fedosIdentityTransitionLineageKeyParts(fact.oldAccountIdentity.authority, fact.oldAccountIdentity.publicIdentifier, fact.oldAccountIdentity.identityId);
}

/** Same key, built from raw parts — used by persistence query methods that do not have a whole fact to hand. */
export function fedosIdentityTransitionLineageKeyParts(authority: string, publicIdentifier: string, identityId: string | null): string {
  return JSON.stringify([authority, publicIdentifier, identityId]);
}

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier && a.identityId === b.identityId;
}

/** Structural equality over every field — decides `"already-present"` (idempotent replay) vs `"conflict"` for a duplicate `transitionId`. */
export function fedosIdentityTransitionFactsAreEqual(a: FedosIdentityTransitionFactV1, b: FedosIdentityTransitionFactV1): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.transitionId === b.transitionId &&
    a.bodyHash === b.bodyHash &&
    accountRefsEqual(a.oldAccountIdentity, b.oldAccountIdentity) &&
    accountRefsEqual(a.newAccountIdentity, b.newAccountIdentity) &&
    a.oldNostrIdentity === b.oldNostrIdentity &&
    a.newNostrIdentity === b.newNostrIdentity &&
    a.revision === b.revision &&
    a.previousTransitionId === b.previousTransitionId &&
    a.evidenceOutcome === b.evidenceOutcome &&
    a.conflictState === b.conflictState &&
    a.supersededByTransitionId === b.supersededByTransitionId &&
    a.recordedAt === b.recordedAt
  );
}

function isNonEmptyBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isWellFormedAccountRef(candidate: unknown): candidate is FedosDeviceBindingAccountRef {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== 3 || !keys.includes("authority") || !keys.includes("publicIdentifier") || !keys.includes("identityId")) {
    return false;
  }
  const r = candidate as Record<string, unknown>;
  return (
    isNonEmptyBoundedString(r.authority, 256) &&
    isNonEmptyBoundedString(r.publicIdentifier, 256) &&
    (r.identityId === null || isNonEmptyBoundedString(r.identityId, 256))
  );
}

const ALL_KNOWN_FIELDS = new Set<string>([
  "schemaVersion",
  "transitionId",
  "bodyHash",
  "oldAccountIdentity",
  "newAccountIdentity",
  "oldNostrIdentity",
  "newNostrIdentity",
  "revision",
  "previousTransitionId",
  "evidenceOutcome",
  "conflictState",
  "supersededByTransitionId",
  "recordedAt",
]);

/** Structural validation only. Fails closed; never throws. */
export function isWellFormedFedosIdentityTransitionFactV1(candidate: unknown): candidate is FedosIdentityTransitionFactV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== ALL_KNOWN_FIELDS.size || !keys.every((k) => ALL_KNOWN_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (!isWellFormedFedosIdentityTransitionId(r.transitionId)) return false;
  if (!isNonEmptyBoundedString(r.bodyHash, 128)) return false;
  if (!isWellFormedAccountRef(r.oldAccountIdentity)) return false;
  if (!isWellFormedAccountRef(r.newAccountIdentity)) return false;
  if (!isNonEmptyBoundedString(r.oldNostrIdentity, 64)) return false;
  if (!isNonEmptyBoundedString(r.newNostrIdentity, 64)) return false;
  if (!Number.isInteger(r.revision) || (r.revision as number) < 0) return false;
  if (r.previousTransitionId !== null && !isWellFormedFedosIdentityTransitionId(r.previousTransitionId)) return false;
  if ((r.revision === 0) !== (r.previousTransitionId === null)) return false;
  if (!(FEDOS_IDENTITY_TRANSITION_KNOWN_EVIDENCE_OUTCOMES as readonly string[]).includes(r.evidenceOutcome as string)) return false;
  if (!(FEDOS_IDENTITY_TRANSITION_KNOWN_FACT_CONFLICT_STATES as readonly string[]).includes(r.conflictState as string)) return false;
  if (r.supersededByTransitionId !== null && !isWellFormedFedosIdentityTransitionId(r.supersededByTransitionId)) return false;
  if (typeof r.recordedAt !== "number" || !Number.isFinite(r.recordedAt)) return false;
  return true;
}

export function encodeFedosIdentityTransitionFactV1(fact: FedosIdentityTransitionFactV1): string {
  return JSON.stringify(fact);
}

/** `null` (never throws) for invalid JSON or a structurally malformed fact — fail closed. */
export function decodeFedosIdentityTransitionFactV1(line: string): FedosIdentityTransitionFactV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosIdentityTransitionFactV1(parsed) ? parsed : null;
}
