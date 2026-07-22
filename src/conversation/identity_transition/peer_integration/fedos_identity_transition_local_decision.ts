/**
 * Secure Runtime Alpha 6121–6200 — durable local decision fact.
 *
 * The prior Arc's own `FedosIdentityTransitionPeerRuntime.recordIdentityTransitionDecision()`
 * computed a decision's EFFECT for one call only — it never durably
 * remembered the decision itself, so a restart (or simply a later
 * `inspectPeerIdentityTransitionStatus()` call passing `"none"`) would
 * silently lose an already-made "accept"/"reject". This file closes that
 * gap: one small, additive, append-only fact recording WHICH explicit
 * decision was made, so `"accepted"`/`"rejected"`/`"deferred"` survive a
 * restart exactly like every other durable fact in this Arc's own
 * lineage — required by this Arc's own Phase C ("explicit local
 * accept/reject/manual-verification decision") and Phase R ("restart …
 * decision … state reconstructs exactly").
 */
import type { FedosDeviceBindingAccountRef } from "../../../device/fedos_device_binding.js";
import { isWellFormedFedosIdentityTransitionId } from "../fedos_identity_transition_id.js";
import { FEDOS_IDENTITY_TRANSITION_MAX_IDENTIFIER_LENGTH } from "../fedos_identity_transition_id_limits.js";
import type { FedosIdentityTransitionExplicitLocalDecision } from "../fedos_identity_transition_acceptance_state.js";

export interface FedosIdentityTransitionLocalDecisionFactV1 {
  readonly schemaVersion: 1;
  readonly localDeviceRef: string;
  readonly peerAccountRef: FedosDeviceBindingAccountRef;
  readonly peerDeviceRef: string;
  readonly transitionId: string;
  /** `"none"` is never itself stored — see `putDecision()`'s own guard. */
  readonly decision: "accept" | "reject" | "defer";
  readonly decidedAt: number;
  readonly revision: number;
}

export function fedosIdentityTransitionLocalDecisionLineageKey(fact: { readonly localDeviceRef: string; readonly peerAccountRef: FedosDeviceBindingAccountRef; readonly peerDeviceRef: string; readonly transitionId: string }): string {
  return JSON.stringify([fact.localDeviceRef, fact.peerAccountRef.authority, fact.peerAccountRef.publicIdentifier, fact.peerAccountRef.identityId, fact.peerDeviceRef, fact.transitionId]);
}

export function fedosIdentityTransitionLocalDecisionKey(fact: FedosIdentityTransitionLocalDecisionFactV1): string {
  return JSON.stringify([fedosIdentityTransitionLocalDecisionLineageKey(fact), fact.revision]);
}

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier && a.identityId === b.identityId;
}

export function fedosIdentityTransitionLocalDecisionFactsAreEqual(a: FedosIdentityTransitionLocalDecisionFactV1, b: FedosIdentityTransitionLocalDecisionFactV1): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.localDeviceRef === b.localDeviceRef &&
    accountRefsEqual(a.peerAccountRef, b.peerAccountRef) &&
    a.peerDeviceRef === b.peerDeviceRef &&
    a.transitionId === b.transitionId &&
    a.decision === b.decision &&
    a.decidedAt === b.decidedAt &&
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

const ALL_KNOWN_FIELDS = new Set<string>(["schemaVersion", "localDeviceRef", "peerAccountRef", "peerDeviceRef", "transitionId", "decision", "decidedAt", "revision"]);
const KNOWN_DECISIONS: ReadonlySet<string> = new Set(["accept", "reject", "defer"]);

export function isWellFormedFedosIdentityTransitionLocalDecisionFactV1(candidate: unknown): candidate is FedosIdentityTransitionLocalDecisionFactV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== ALL_KNOWN_FIELDS.size || !keys.every((k) => ALL_KNOWN_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (!isNonEmptyBoundedString(r.localDeviceRef)) return false;
  if (!isWellFormedAccountRef(r.peerAccountRef)) return false;
  if (!isNonEmptyBoundedString(r.peerDeviceRef)) return false;
  if (!isWellFormedFedosIdentityTransitionId(r.transitionId)) return false;
  if (!KNOWN_DECISIONS.has(r.decision as string)) return false;
  if (typeof r.decidedAt !== "number" || !Number.isFinite(r.decidedAt)) return false;
  if (!Number.isInteger(r.revision) || (r.revision as number) < 0) return false;
  return true;
}

export function encodeFedosIdentityTransitionLocalDecisionFactV1(fact: FedosIdentityTransitionLocalDecisionFactV1): string {
  return JSON.stringify(fact);
}

export function decodeFedosIdentityTransitionLocalDecisionFactV1(line: string): FedosIdentityTransitionLocalDecisionFactV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosIdentityTransitionLocalDecisionFactV1(parsed) ? parsed : null;
}

export interface FedosIdentityTransitionLocalDecisionPersistence {
  putDecision(fact: FedosIdentityTransitionLocalDecisionFactV1): "inserted" | "already-present" | "conflict" | "stale-revision" | "failed";
  getLatestDecision(localDeviceRef: string, peerAccountRef: FedosDeviceBindingAccountRef, peerDeviceRef: string, transitionId: string): FedosIdentityTransitionExplicitLocalDecision;
  getLatestDecisionFact(localDeviceRef: string, peerAccountRef: FedosDeviceBindingAccountRef, peerDeviceRef: string, transitionId: string): FedosIdentityTransitionLocalDecisionFactV1 | null;
  listDecisions(): readonly FedosIdentityTransitionLocalDecisionFactV1[];
}

function latestOf(matches: readonly FedosIdentityTransitionLocalDecisionFactV1[]): FedosIdentityTransitionExplicitLocalDecision {
  if (matches.length === 0) return "none";
  const latest = matches.reduce((best, f) => (f.revision > best.revision ? f : best));
  return latest.decision === "defer" ? "none" : latest.decision;
}

export class InMemoryFedosIdentityTransitionLocalDecisionPersistence implements FedosIdentityTransitionLocalDecisionPersistence {
  readonly #facts = new Map<string, FedosIdentityTransitionLocalDecisionFactV1>();

  putDecision(fact: FedosIdentityTransitionLocalDecisionFactV1): "inserted" | "already-present" | "conflict" | "stale-revision" | "failed" {
    const existingByKey = this.#facts.get(fedosIdentityTransitionLocalDecisionKey(fact));
    if (existingByKey !== undefined) {
      return fedosIdentityTransitionLocalDecisionFactsAreEqual(existingByKey, fact) ? "already-present" : "conflict";
    }
    const lineage = [...this.#facts.values()].filter((f) => fedosIdentityTransitionLocalDecisionLineageKey(f) === fedosIdentityTransitionLocalDecisionLineageKey(fact));
    const maxRevision = lineage.reduce((max, f) => Math.max(max, f.revision), -1);
    if (fact.revision <= maxRevision) return "stale-revision";
    this.#facts.set(fedosIdentityTransitionLocalDecisionKey(fact), fact);
    return "inserted";
  }

  getLatestDecision(localDeviceRef: string, peerAccountRef: FedosDeviceBindingAccountRef, peerDeviceRef: string, transitionId: string): FedosIdentityTransitionExplicitLocalDecision {
    const lineageKey = fedosIdentityTransitionLocalDecisionLineageKey({ localDeviceRef, peerAccountRef, peerDeviceRef, transitionId });
    const matches = [...this.#facts.values()].filter((f) => fedosIdentityTransitionLocalDecisionLineageKey(f) === lineageKey);
    return latestOf(matches);
  }

  getLatestDecisionFact(localDeviceRef: string, peerAccountRef: FedosDeviceBindingAccountRef, peerDeviceRef: string, transitionId: string): FedosIdentityTransitionLocalDecisionFactV1 | null {
    const lineageKey = fedosIdentityTransitionLocalDecisionLineageKey({ localDeviceRef, peerAccountRef, peerDeviceRef, transitionId });
    const matches = [...this.#facts.values()].filter((f) => fedosIdentityTransitionLocalDecisionLineageKey(f) === lineageKey);
    if (matches.length === 0) return null;
    return matches.reduce((best, f) => (f.revision > best.revision ? f : best));
  }

  listDecisions(): readonly FedosIdentityTransitionLocalDecisionFactV1[] {
    return [...this.#facts.values()];
  }
}
