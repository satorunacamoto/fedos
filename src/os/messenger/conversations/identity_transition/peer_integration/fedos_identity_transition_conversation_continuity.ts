/**
 * Secure Runtime Alpha 6121–6200 — Phase F/G: the Conversation Continuity
 * mapping.
 *
 * The SMALLEST additive model consistent with `45e0fce`: this file does
 * NOT rewrite the existing Direct Conversation ID, does NOT touch
 * Membership, Archive, or Search, and does NOT duplicate the Foundation's
 * own evidence/acceptance vocabularies — `evidenceLevel` here is a
 * REFERENCE to the already-computed `FedosIdentityTransitionAcceptanceState`
 * from the linked Peer Observation, never a re-derivation. This record
 * exists ONLY because the Peer Observation record has no
 * `conversationId`/verification-method/new-session-required fields, and
 * a Direct Conversation-scoped continuity fact genuinely needs them.
 *
 * A NEW mapping for the SAME `(localDeviceRef, conversationId)` with a
 * strictly higher `revision` is a legitimate supersession (append-only,
 * never an overwrite); the OLD mapping is never rewritten — supersession
 * is derived at read time, exactly like every other domain in this Arc's
 * own lineage.
 *
 * HARD GUARDRAILS: no message plaintext, no secret, no historical-record
 * mutation.
 */
import type { FedosDeviceBindingAccountRef } from "../../../device/fedos_device_binding.js";
import { isWellFormedFedosIdentityTransitionId } from "../fedos_identity_transition_id.js";
import { FEDOS_IDENTITY_TRANSITION_MAX_IDENTIFIER_LENGTH } from "../fedos_identity_transition_id_limits.js";
import { FEDOS_IDENTITY_TRANSITION_KNOWN_ACCEPTANCE_STATES, type FedosIdentityTransitionAcceptanceState } from "../fedos_identity_transition_acceptance_state.js";
import {
  FEDOS_IDENTITY_TRANSITION_KNOWN_MANUAL_VERIFICATION_METHODS,
  type FedosIdentityTransitionManualVerificationMethod,
} from "./fedos_identity_transition_manual_verification.js";

export interface FedosIdentityTransitionConversationContinuityRecordV1 {
  readonly schemaVersion: 1;
  readonly localDeviceRef: string;
  readonly conversationId: string;
  readonly oldAccountIdentity: FedosDeviceBindingAccountRef;
  readonly newAccountIdentity: FedosDeviceBindingAccountRef;
  readonly transitionId: string;
  readonly revision: number;
  /** Reference only — computed once by the Peer Runtime from the linked Peer Observation, never re-derived here. */
  readonly evidenceLevel: FedosIdentityTransitionAcceptanceState;
  readonly verificationMethod: FedosIdentityTransitionManualVerificationMethod | null;
  readonly acceptedAt: number;
  /** `true` once this mapping is known to require a fresh Ratchet Device-pair session (Phase H) — informational, never applied here. */
  readonly newSessionRequired: boolean;
}

export function fedosIdentityTransitionConversationContinuityKey(record: FedosIdentityTransitionConversationContinuityRecordV1): string {
  return JSON.stringify([record.localDeviceRef, record.conversationId, record.transitionId]);
}

export function fedosIdentityTransitionConversationContinuityLineageKey(record: FedosIdentityTransitionConversationContinuityRecordV1): string {
  return JSON.stringify([record.localDeviceRef, record.conversationId]);
}

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier && a.identityId === b.identityId;
}

export function fedosIdentityTransitionConversationContinuityRecordsAreEqual(
  a: FedosIdentityTransitionConversationContinuityRecordV1,
  b: FedosIdentityTransitionConversationContinuityRecordV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.localDeviceRef === b.localDeviceRef &&
    a.conversationId === b.conversationId &&
    accountRefsEqual(a.oldAccountIdentity, b.oldAccountIdentity) &&
    accountRefsEqual(a.newAccountIdentity, b.newAccountIdentity) &&
    a.transitionId === b.transitionId &&
    a.revision === b.revision &&
    a.evidenceLevel === b.evidenceLevel &&
    a.verificationMethod === b.verificationMethod &&
    a.acceptedAt === b.acceptedAt &&
    a.newSessionRequired === b.newSessionRequired
  );
}

function isNonEmptyBoundedString(value: unknown, maxLength = FEDOS_IDENTITY_TRANSITION_MAX_IDENTIFIER_LENGTH): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isWellFormedAccountRef(candidate: unknown): candidate is FedosDeviceBindingAccountRef {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== 3 || !keys.includes("authority") || !keys.includes("publicIdentifier") || !keys.includes("identityId")) return false;
  const r = candidate as Record<string, unknown>;
  return isNonEmptyBoundedString(r.authority) && isNonEmptyBoundedString(r.publicIdentifier) && (r.identityId === null || isNonEmptyBoundedString(r.identityId));
}

const ALL_KNOWN_FIELDS = new Set<string>([
  "schemaVersion",
  "localDeviceRef",
  "conversationId",
  "oldAccountIdentity",
  "newAccountIdentity",
  "transitionId",
  "revision",
  "evidenceLevel",
  "verificationMethod",
  "acceptedAt",
  "newSessionRequired",
]);

/** Structural validation only. Fails closed; never throws. */
export function isWellFormedFedosIdentityTransitionConversationContinuityRecordV1(candidate: unknown): candidate is FedosIdentityTransitionConversationContinuityRecordV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== ALL_KNOWN_FIELDS.size || !keys.every((k) => ALL_KNOWN_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (!isNonEmptyBoundedString(r.localDeviceRef)) return false;
  if (!isNonEmptyBoundedString(r.conversationId)) return false;
  if (!isWellFormedAccountRef(r.oldAccountIdentity)) return false;
  if (!isWellFormedAccountRef(r.newAccountIdentity)) return false;
  if (!isWellFormedFedosIdentityTransitionId(r.transitionId)) return false;
  if (!Number.isInteger(r.revision) || (r.revision as number) < 0) return false;
  if (!(FEDOS_IDENTITY_TRANSITION_KNOWN_ACCEPTANCE_STATES as readonly string[]).includes(r.evidenceLevel as string)) return false;
  if (r.verificationMethod !== null && !(FEDOS_IDENTITY_TRANSITION_KNOWN_MANUAL_VERIFICATION_METHODS as readonly string[]).includes(r.verificationMethod as string)) {
    return false;
  }
  if (typeof r.acceptedAt !== "number" || !Number.isFinite(r.acceptedAt)) return false;
  if (typeof r.newSessionRequired !== "boolean") return false;
  return true;
}

export function encodeFedosIdentityTransitionConversationContinuityRecordV1(record: FedosIdentityTransitionConversationContinuityRecordV1): string {
  return JSON.stringify(record);
}

/** `null` (never throws) for invalid JSON or a structurally malformed record — fail closed. */
export function decodeFedosIdentityTransitionConversationContinuityRecordV1(line: string): FedosIdentityTransitionConversationContinuityRecordV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosIdentityTransitionConversationContinuityRecordV1(parsed) ? parsed : null;
}

export type FedosIdentityTransitionConversationContinuityWriteOutcome = "inserted" | "already-present" | "conflict" | "rollback-detected" | "failed";

/** Pure — mirrors this Arc's own lineage-conflict-detection pattern, scoped to `(localDeviceRef, conversationId)`. */
export function determineFedosIdentityTransitionConversationContinuityWriteOutcome(
  existing: readonly FedosIdentityTransitionConversationContinuityRecordV1[],
  candidate: FedosIdentityTransitionConversationContinuityRecordV1,
): FedosIdentityTransitionConversationContinuityWriteOutcome {
  const sameKey = existing.find((r) => fedosIdentityTransitionConversationContinuityKey(r) === fedosIdentityTransitionConversationContinuityKey(candidate));
  if (sameKey !== undefined) {
    return fedosIdentityTransitionConversationContinuityRecordsAreEqual(sameKey, candidate) ? "already-present" : "conflict";
  }
  const lineage = existing.filter((r) => fedosIdentityTransitionConversationContinuityLineageKey(r) === fedosIdentityTransitionConversationContinuityLineageKey(candidate));
  const conflictingDifferentTransition = lineage.find((r) => r.transitionId !== candidate.transitionId && r.revision === candidate.revision);
  if (conflictingDifferentTransition !== undefined) return "conflict";
  const maxRevision = lineage.reduce((max, r) => Math.max(max, r.revision), -1);
  if (candidate.revision <= maxRevision) return "rollback-detected";
  return "inserted";
}

/** Pure query — derived, never stored mutably. */
export function isFedosIdentityTransitionConversationContinuitySuperseded(
  record: FedosIdentityTransitionConversationContinuityRecordV1,
  lineage: readonly FedosIdentityTransitionConversationContinuityRecordV1[],
): boolean {
  return lineage.some((r) => r.transitionId !== record.transitionId && r.revision > record.revision);
}

export interface FedosIdentityTransitionConversationContinuityPersistence {
  putRecord(record: FedosIdentityTransitionConversationContinuityRecordV1): FedosIdentityTransitionConversationContinuityWriteOutcome;
  getCurrentForConversation(localDeviceRef: string, conversationId: string): FedosIdentityTransitionConversationContinuityRecordV1 | null;
  listForConversation(localDeviceRef: string, conversationId: string): readonly FedosIdentityTransitionConversationContinuityRecordV1[];
  listRecords(): readonly FedosIdentityTransitionConversationContinuityRecordV1[];
}

export class InMemoryFedosIdentityTransitionConversationContinuityPersistence implements FedosIdentityTransitionConversationContinuityPersistence {
  readonly #records = new Map<string, FedosIdentityTransitionConversationContinuityRecordV1>();

  putRecord(record: FedosIdentityTransitionConversationContinuityRecordV1): FedosIdentityTransitionConversationContinuityWriteOutcome {
    const outcome = determineFedosIdentityTransitionConversationContinuityWriteOutcome([...this.#records.values()], record);
    if (outcome === "inserted") this.#records.set(fedosIdentityTransitionConversationContinuityKey(record), record);
    return outcome;
  }

  listForConversation(localDeviceRef: string, conversationId: string): readonly FedosIdentityTransitionConversationContinuityRecordV1[] {
    const key = JSON.stringify([localDeviceRef, conversationId]);
    return [...this.#records.values()].filter((r) => fedosIdentityTransitionConversationContinuityLineageKey(r) === key);
  }

  getCurrentForConversation(localDeviceRef: string, conversationId: string): FedosIdentityTransitionConversationContinuityRecordV1 | null {
    const rows = this.listForConversation(localDeviceRef, conversationId);
    if (rows.length === 0) return null;
    return rows.reduce((latest, r) => (r.revision > latest.revision ? r : latest));
  }

  listRecords(): readonly FedosIdentityTransitionConversationContinuityRecordV1[] {
    return [...this.#records.values()];
  }
}
