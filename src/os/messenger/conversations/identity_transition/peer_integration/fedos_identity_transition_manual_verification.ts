/**
 * Secure Runtime Alpha 6121–6200 (FedOS Identity Replacement User
 * Verification and Conversation Continuity UI Arc) — Phase D: the
 * narrow local manual-verification fact.
 *
 * A local trust decision, never universal proof — this file's own
 * `FedosIdentityTransitionManualVerificationFactV1` records ONLY that
 * THIS local profile/Device performed a named, closed-vocabulary
 * verification method at a point in time, never the content of that
 * verification (no transcript, no photo, no external secret). Reused by
 * the evidence evaluator's `manualVerificationConfirmed` flag one layer
 * up (the Shell/Controller decide when to pass `true`, this file only
 * durably records the fact that a human said they did it).
 *
 * HARD GUARDRAILS: no arbitrary free-form secret, no external chat
 * transcript, no photo, no private key, no passphrase.
 */
import type { FedosDeviceBindingAccountRef } from "../../../../../device/fedos_device_binding.js";
import { isWellFormedFedosIdentityTransitionId } from "../../../../../conversation/identity_transition/fedos_identity_transition_id.js";
import { FEDOS_IDENTITY_TRANSITION_MAX_IDENTIFIER_LENGTH } from "../../../../../conversation/identity_transition/fedos_identity_transition_id_limits.js";

/** Closed set — "another locally selected closed method supported by the review" is deliberately NOT open-ended; a future Arc adds a new value here, never a free-form string. */
export type FedosIdentityTransitionManualVerificationMethod =
  | "safety-number-comparison"
  | "out-of-band-confirmation"
  | "in-person-confirmation";

export const FEDOS_IDENTITY_TRANSITION_KNOWN_MANUAL_VERIFICATION_METHODS: readonly FedosIdentityTransitionManualVerificationMethod[] = Object.freeze([
  "safety-number-comparison",
  "out-of-band-confirmation",
  "in-person-confirmation",
]);

export function isKnownFedosIdentityTransitionManualVerificationMethod(value: unknown): value is FedosIdentityTransitionManualVerificationMethod {
  return typeof value === "string" && (FEDOS_IDENTITY_TRANSITION_KNOWN_MANUAL_VERIFICATION_METHODS as readonly string[]).includes(value);
}

/** A coarse, closed note code only — never a free-form string (Absolute Prohibitions: no arbitrary free-form secret). */
export type FedosIdentityTransitionManualVerificationNoteCode =
  | "none"
  | "confirmed-match"
  | "confirmed-by-phone"
  | "confirmed-in-person"
  | "could-not-confirm";

export const FEDOS_IDENTITY_TRANSITION_KNOWN_MANUAL_VERIFICATION_NOTE_CODES: readonly FedosIdentityTransitionManualVerificationNoteCode[] = Object.freeze([
  "none",
  "confirmed-match",
  "confirmed-by-phone",
  "confirmed-in-person",
  "could-not-confirm",
]);

export function isKnownFedosIdentityTransitionManualVerificationNoteCode(value: unknown): value is FedosIdentityTransitionManualVerificationNoteCode {
  return typeof value === "string" && (FEDOS_IDENTITY_TRANSITION_KNOWN_MANUAL_VERIFICATION_NOTE_CODES as readonly string[]).includes(value);
}

export interface FedosIdentityTransitionManualVerificationFactV1 {
  readonly schemaVersion: 1;
  readonly transitionId: string;
  /** THIS local profile's own account — the verifier, never the transition's subject. */
  readonly verifierAccountRef: FedosDeviceBindingAccountRef;
  readonly localDeviceRef: string;
  readonly method: FedosIdentityTransitionManualVerificationMethod;
  readonly verifiedAt: number;
  readonly noteCode: FedosIdentityTransitionManualVerificationNoteCode;
  /** Monotonic per (localDeviceRef, verifierAccountRef, transitionId) — a re-verification (e.g. after a stale prior confirmation) is a NEW, higher-revision fact, never an overwrite. */
  readonly revision: number;
}

export function fedosIdentityTransitionManualVerificationKey(fact: FedosIdentityTransitionManualVerificationFactV1): string {
  return JSON.stringify([fact.localDeviceRef, fact.verifierAccountRef.authority, fact.verifierAccountRef.publicIdentifier, fact.verifierAccountRef.identityId, fact.transitionId, fact.revision]);
}

export function fedosIdentityTransitionManualVerificationLineageKey(fact: FedosIdentityTransitionManualVerificationFactV1): string {
  return JSON.stringify([fact.localDeviceRef, fact.verifierAccountRef.authority, fact.verifierAccountRef.publicIdentifier, fact.verifierAccountRef.identityId, fact.transitionId]);
}

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier && a.identityId === b.identityId;
}

export function fedosIdentityTransitionManualVerificationFactsAreEqual(
  a: FedosIdentityTransitionManualVerificationFactV1,
  b: FedosIdentityTransitionManualVerificationFactV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.transitionId === b.transitionId &&
    accountRefsEqual(a.verifierAccountRef, b.verifierAccountRef) &&
    a.localDeviceRef === b.localDeviceRef &&
    a.method === b.method &&
    a.verifiedAt === b.verifiedAt &&
    a.noteCode === b.noteCode &&
    a.revision === b.revision
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

const ALL_KNOWN_FIELDS = new Set<string>(["schemaVersion", "transitionId", "verifierAccountRef", "localDeviceRef", "method", "verifiedAt", "noteCode", "revision"]);

/** Structural validation only. Fails closed; never throws. Unknown methods/note codes fail closed. */
export function isWellFormedFedosIdentityTransitionManualVerificationFactV1(candidate: unknown): candidate is FedosIdentityTransitionManualVerificationFactV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== ALL_KNOWN_FIELDS.size || !keys.every((k) => ALL_KNOWN_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (!isWellFormedFedosIdentityTransitionId(r.transitionId)) return false;
  if (!isWellFormedAccountRef(r.verifierAccountRef)) return false;
  if (!isNonEmptyBoundedString(r.localDeviceRef)) return false;
  if (!isKnownFedosIdentityTransitionManualVerificationMethod(r.method)) return false;
  if (typeof r.verifiedAt !== "number" || !Number.isFinite(r.verifiedAt)) return false;
  if (!isKnownFedosIdentityTransitionManualVerificationNoteCode(r.noteCode)) return false;
  if (!Number.isInteger(r.revision) || (r.revision as number) < 0) return false;
  return true;
}

export function encodeFedosIdentityTransitionManualVerificationFactV1(fact: FedosIdentityTransitionManualVerificationFactV1): string {
  return JSON.stringify(fact);
}

/** `null` (never throws) for invalid JSON or a structurally malformed fact — fail closed. */
export function decodeFedosIdentityTransitionManualVerificationFactV1(line: string): FedosIdentityTransitionManualVerificationFactV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosIdentityTransitionManualVerificationFactV1(parsed) ? parsed : null;
}

export interface FedosIdentityTransitionManualVerificationPersistence {
  putFact(fact: FedosIdentityTransitionManualVerificationFactV1): "inserted" | "already-present" | "conflict" | "stale-revision" | "failed";
  /** The single latest (highest-revision) fact for one (localDeviceRef, verifierAccountRef, transitionId), or `null` if none exists. */
  getLatestFact(localDeviceRef: string, verifierAccountRef: FedosDeviceBindingAccountRef, transitionId: string): FedosIdentityTransitionManualVerificationFactV1 | null;
  listFacts(): readonly FedosIdentityTransitionManualVerificationFactV1[];
}

function putLogic(existing: readonly FedosIdentityTransitionManualVerificationFactV1[], candidate: FedosIdentityTransitionManualVerificationFactV1): "inserted" | "already-present" | "conflict" | "stale-revision" {
  const sameKey = existing.find((f) => fedosIdentityTransitionManualVerificationKey(f) === fedosIdentityTransitionManualVerificationKey(candidate));
  if (sameKey !== undefined) {
    return fedosIdentityTransitionManualVerificationFactsAreEqual(sameKey, candidate) ? "already-present" : "conflict";
  }
  const lineage = existing.filter((f) => fedosIdentityTransitionManualVerificationLineageKey(f) === fedosIdentityTransitionManualVerificationLineageKey(candidate));
  const maxRevision = lineage.reduce((max, f) => Math.max(max, f.revision), -1);
  if (candidate.revision <= maxRevision) return "stale-revision";
  return "inserted";
}

export class InMemoryFedosIdentityTransitionManualVerificationPersistence implements FedosIdentityTransitionManualVerificationPersistence {
  readonly #facts = new Map<string, FedosIdentityTransitionManualVerificationFactV1>();

  putFact(fact: FedosIdentityTransitionManualVerificationFactV1): "inserted" | "already-present" | "conflict" | "stale-revision" | "failed" {
    const outcome = putLogic([...this.#facts.values()], fact);
    if (outcome === "inserted") this.#facts.set(fedosIdentityTransitionManualVerificationKey(fact), fact);
    return outcome;
  }

  getLatestFact(localDeviceRef: string, verifierAccountRef: FedosDeviceBindingAccountRef, transitionId: string): FedosIdentityTransitionManualVerificationFactV1 | null {
    const lineageKey = JSON.stringify([localDeviceRef, verifierAccountRef.authority, verifierAccountRef.publicIdentifier, verifierAccountRef.identityId, transitionId]);
    const matches = [...this.#facts.values()].filter((f) => fedosIdentityTransitionManualVerificationLineageKey(f) === lineageKey);
    if (matches.length === 0) return null;
    return matches.reduce((latest, f) => (f.revision > latest.revision ? f : latest));
  }

  listFacts(): readonly FedosIdentityTransitionManualVerificationFactV1[] {
    return [...this.#facts.values()];
  }
}
