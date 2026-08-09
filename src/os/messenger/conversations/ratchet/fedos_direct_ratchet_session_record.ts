/**
 * Secure Runtime Alpha 5401-5480 — Phase D: `DirectRatchetSessionRecordV1`
 * -- the closed, versioned, PUBLIC-ONLY session metadata record. Every
 * field here is safe to persist in a plain NDJSON append-only log; no
 * field ever carries secret-derived bytes (secret-bearing material is
 * referenced only by opaque `sealedSecretRecordId` strings pointing into
 * `./persistence/fedos_sealed_direct_ratchet_secret_persistence.ts`).
 */
import {
  fedosDirectRatchetSessionBindingsEqual,
  type FedosDirectRatchetSessionBinding,
} from "./fedos_direct_ratchet_session_binding.js";
import {
  FEDOS_DIRECT_RATCHET_SESSION_LIFECYCLE_STATES,
  type FedosDirectRatchetSessionLifecycleState,
} from "./fedos_direct_ratchet_session_lifecycle.js";
import { isWellFormedFedosDirectRatchetCounters, type FedosDirectRatchetCounters } from "./fedos_direct_ratchet_counters.js";
import type { FedosDirectRatchetSkippedKeyReference } from "./fedos_direct_ratchet_skipped_key_index.js";

export interface FedosDirectRatchetSessionRecordV1 {
  readonly schemaVersion: 1;
  /** Event-sourced snapshot revision for this `binding.sessionId` -- starts at `0`, strictly increments by exactly 1 per logical state change (mission Phase G's own "append-only/event-sourced convention": a state change is a NEW appended revision, never an overwrite of a prior one). `binding` itself (including `sessionId`) must be IDENTICAL across every revision of the same session -- only `lifecycleState`/`counters`/`skippedKeyReferences`/`sealedSecretRecordIds`/`lastActivityAt` may differ between revisions. */
  readonly revision: number;
  readonly binding: FedosDirectRatchetSessionBinding;
  readonly lifecycleState: FedosDirectRatchetSessionLifecycleState;
  readonly counters: FedosDirectRatchetCounters;
  readonly createdAt: number;
  readonly lastActivityAt: number;
  readonly skippedKeyReferences: readonly FedosDirectRatchetSkippedKeyReference[];
  /** Opaque pointers only -- see `./fedos_sealed_direct_ratchet_secret_record.ts`. Never a secret byte. */
  readonly sealedSecretRecordIds: readonly string[];
}

const ALL_KNOWN_FIELDS = new Set<string>([
  "schemaVersion",
  "revision",
  "binding",
  "lifecycleState",
  "counters",
  "createdAt",
  "lastActivityAt",
  "skippedKeyReferences",
  "sealedSecretRecordIds",
]);

const ALL_KNOWN_BINDING_FIELDS = new Set<string>([
  "sessionId",
  "localAccountRef",
  "localDeviceRef",
  "remoteAccountRef",
  "remoteDeviceRef",
  "conversationId",
  "suite",
  "generation",
]);

const ALL_KNOWN_ACCOUNT_REF_FIELDS = new Set<string>(["authority", "publicIdentifier", "identityId"]);

const ALL_KNOWN_SKIPPED_KEY_REFERENCE_FIELDS = new Set<string>(["chainCounter", "sealedRecordId", "createdAt"]);

function hasExactFields(value: unknown, fields: ReadonlySet<string>): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const keys = Object.keys(value);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

function isWellFormedBinding(candidate: unknown): candidate is FedosDirectRatchetSessionBinding {
  if (!hasExactFields(candidate, ALL_KNOWN_BINDING_FIELDS)) return false;
  const b = candidate as Record<string, unknown>;
  if (typeof b.sessionId !== "string" || b.sessionId.length === 0) return false;
  if (!hasExactFields(b.localAccountRef, ALL_KNOWN_ACCOUNT_REF_FIELDS)) return false;
  if (!hasExactFields(b.remoteAccountRef, ALL_KNOWN_ACCOUNT_REF_FIELDS)) return false;
  if (typeof b.localDeviceRef !== "string" || b.localDeviceRef.length === 0) return false;
  if (typeof b.remoteDeviceRef !== "string" || b.remoteDeviceRef.length === 0) return false;
  if (typeof b.conversationId !== "string" || b.conversationId.length === 0) return false;
  if (typeof b.suite !== "string" || b.suite.length === 0) return false;
  if (!Number.isInteger(b.generation) || (b.generation as number) < 0) return false;
  return true;
}

function isWellFormedSkippedKeyReference(candidate: unknown): candidate is FedosDirectRatchetSkippedKeyReference {
  if (!hasExactFields(candidate, ALL_KNOWN_SKIPPED_KEY_REFERENCE_FIELDS)) return false;
  const s = candidate as Record<string, unknown>;
  return (
    Number.isInteger(s.chainCounter) &&
    (s.chainCounter as number) >= 0 &&
    typeof s.sealedRecordId === "string" &&
    s.sealedRecordId.length > 0 &&
    typeof s.createdAt === "number" &&
    Number.isFinite(s.createdAt)
  );
}

/**
 * Strict structural validation: exact closed field set at every nesting
 * level (record, binding, account refs, each skipped-key reference) --
 * an unrecognized field anywhere fails the whole record closed. Never
 * throws. Does not check lifecycle-transition validity (that is
 * `isFedosDirectRatchetSessionLifecycleTransitionAllowed`'s job,
 * evaluated by the Runtime facade, not the codec).
 */
export function isWellFormedFedosDirectRatchetSessionRecordV1(
  candidate: unknown,
): candidate is FedosDirectRatchetSessionRecordV1 {
  if (!hasExactFields(candidate, ALL_KNOWN_FIELDS)) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (!Number.isInteger(r.revision) || (r.revision as number) < 0) return false;
  if (!isWellFormedBinding(r.binding)) return false;
  if (!FEDOS_DIRECT_RATCHET_SESSION_LIFECYCLE_STATES.includes(r.lifecycleState as FedosDirectRatchetSessionLifecycleState)) {
    return false;
  }
  if (!isWellFormedFedosDirectRatchetCounters(r.counters)) return false;
  if (typeof r.createdAt !== "number" || !Number.isFinite(r.createdAt)) return false;
  if (typeof r.lastActivityAt !== "number" || !Number.isFinite(r.lastActivityAt)) return false;
  if (!Array.isArray(r.skippedKeyReferences) || !r.skippedKeyReferences.every(isWellFormedSkippedKeyReference)) {
    return false;
  }
  if (!Array.isArray(r.sealedSecretRecordIds) || !r.sealedSecretRecordIds.every((id) => typeof id === "string" && id.length > 0)) {
    return false;
  }
  return true;
}

/** JSON codec pair -- append-only backends (Phase G) persist exactly `encode()`'s own output, one record per line. */
export function encodeFedosDirectRatchetSessionRecordV1(record: FedosDirectRatchetSessionRecordV1): string {
  return JSON.stringify(record);
}

/** Returns `null` (never throws) for invalid JSON OR a structurally malformed record -- fail closed, matching `AppendOnlyFedosConversationPersistence`'s own "malformed line voids the read" precedent. */
export function decodeFedosDirectRatchetSessionRecordV1(line: string): FedosDirectRatchetSessionRecordV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosDirectRatchetSessionRecordV1(parsed) ? parsed : null;
}

/** Two records are conflicting duplicates iff they share a `binding.sessionId` but disagree on ANY other field -- the append-only backend's own conflict-vs-idempotent-repeat test (Phase G). */
export function fedosDirectRatchetSessionRecordsEqual(
  a: FedosDirectRatchetSessionRecordV1,
  b: FedosDirectRatchetSessionRecordV1,
): boolean {
  if (!fedosDirectRatchetSessionBindingsEqual(a.binding, b.binding)) return false;
  return encodeFedosDirectRatchetSessionRecordV1(a) === encodeFedosDirectRatchetSessionRecordV1(b);
}
