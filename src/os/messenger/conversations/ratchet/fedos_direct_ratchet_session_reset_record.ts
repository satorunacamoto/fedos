/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — the durable Session Reset audit record. Mirrors
 * `../../device/persistence/fedos_persisted_device_binding_challenge_consumption_v1.ts`'s
 * own "one immutable fact per nonce" discipline exactly: this is BOTH the
 * durable audit trail this Arc's own brief names ("durable reset records")
 * AND the nonce-keyed replay-protection ledger ("replay protection across
 * reset") — the SAME record serves both purposes, deliberately, rather
 * than maintaining two parallel stores of the same fact.
 *
 * Keyed by `nonce` ALONE — the reset's own tuple/generation/reason content
 * is already bound into the signed-or-envelope-authenticated content that
 * produced this nonce (`fedos_direct_ratchet_session_reset_authentication.ts`),
 * so a nonce collision across two logically different resets cannot happen
 * without a genuine CSPRNG break, which this file does not attempt to
 * defend against (identical to the Device Binding Challenge replay
 * ledger's own stated position).
 */
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import type { FedosDirectRatchetSuite } from "./fedos_direct_ratchet_session_id.js";
import type { FedosDirectRatchetSessionResetReason } from "./fedos_direct_ratchet_session_reset_reason.js";

export type FedosDirectRatchetSessionResetInitiator = "local" | "remote";

export type FedosDirectRatchetSessionResetOutcome =
  | "accepted-initial"
  | "accepted-reset"
  | "rejected-device-untrusted"
  | "rejected-generation-mismatch"
  | "rejected-signature";

export interface FedosDirectRatchetSessionResetRecordV1 {
  readonly schemaVersion: 1;
  readonly nonce: string;
  readonly localAccountRef: FedosDeviceBindingAccountRef;
  readonly localDeviceRef: string;
  readonly remoteAccountRef: FedosDeviceBindingAccountRef;
  readonly remoteDeviceRef: string;
  readonly conversationId: string;
  readonly suite: FedosDirectRatchetSuite;
  readonly previousGeneration: number | null;
  readonly newGeneration: number;
  readonly reason: FedosDirectRatchetSessionResetReason | null;
  /** Whether THIS local Runtime initiated the reset (it called `establishSession()`) or received one from the remote party (`#receiveSessionInit()`). Two independent Runtimes of the SAME logical reset each record their own row with their own `initiator`/`recordedAt` — never a shared row. */
  readonly initiator: FedosDirectRatchetSessionResetInitiator;
  readonly outcome: FedosDirectRatchetSessionResetOutcome;
  readonly recordedAt: number;
}

/** Keyed by `nonce` alone — see this file's own header. */
export function fedosDirectRatchetSessionResetRecordKey(record: FedosDirectRatchetSessionResetRecordV1): string {
  return record.nonce;
}

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier && a.identityId === b.identityId;
}

/** Structural equality over every field — used to decide `"already-present"` (idempotent replay) vs `"conflict"` for a duplicate nonce. */
export function fedosDirectRatchetSessionResetRecordsAreEqual(
  a: FedosDirectRatchetSessionResetRecordV1,
  b: FedosDirectRatchetSessionResetRecordV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.nonce === b.nonce &&
    accountRefsEqual(a.localAccountRef, b.localAccountRef) &&
    a.localDeviceRef === b.localDeviceRef &&
    accountRefsEqual(a.remoteAccountRef, b.remoteAccountRef) &&
    a.remoteDeviceRef === b.remoteDeviceRef &&
    a.conversationId === b.conversationId &&
    a.suite === b.suite &&
    a.previousGeneration === b.previousGeneration &&
    a.newGeneration === b.newGeneration &&
    a.reason === b.reason &&
    a.initiator === b.initiator &&
    a.outcome === b.outcome &&
    a.recordedAt === b.recordedAt
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isWellFormedAccountRef(candidate: unknown): candidate is FedosDeviceBindingAccountRef {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== 3 || !keys.includes("authority") || !keys.includes("publicIdentifier") || !keys.includes("identityId")) {
    return false;
  }
  const r = candidate as Record<string, unknown>;
  return isNonEmptyString(r.authority) && isNonEmptyString(r.publicIdentifier) && (r.identityId === null || isNonEmptyString(r.identityId));
}

const ALL_KNOWN_FIELDS = new Set<string>([
  "schemaVersion",
  "nonce",
  "localAccountRef",
  "localDeviceRef",
  "remoteAccountRef",
  "remoteDeviceRef",
  "conversationId",
  "suite",
  "previousGeneration",
  "newGeneration",
  "reason",
  "initiator",
  "outcome",
  "recordedAt",
]);

const KNOWN_OUTCOMES: readonly FedosDirectRatchetSessionResetOutcome[] = [
  "accepted-initial",
  "accepted-reset",
  "rejected-device-untrusted",
  "rejected-generation-mismatch",
  "rejected-signature",
];

/** Structural validation only. Fails closed; never throws. */
export function isWellFormedFedosDirectRatchetSessionResetRecordV1(
  candidate: unknown,
): candidate is FedosDirectRatchetSessionResetRecordV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== ALL_KNOWN_FIELDS.size || !keys.every((k) => ALL_KNOWN_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (!isNonEmptyString(r.nonce)) return false;
  if (!isWellFormedAccountRef(r.localAccountRef)) return false;
  if (!isNonEmptyString(r.localDeviceRef)) return false;
  if (!isWellFormedAccountRef(r.remoteAccountRef)) return false;
  if (!isNonEmptyString(r.remoteDeviceRef)) return false;
  if (!isNonEmptyString(r.conversationId)) return false;
  if (!isNonEmptyString(r.suite)) return false;
  if (r.previousGeneration !== null && (!Number.isInteger(r.previousGeneration) || (r.previousGeneration as number) < 0)) return false;
  if (!Number.isInteger(r.newGeneration) || (r.newGeneration as number) < 0) return false;
  if (r.reason !== null && typeof r.reason !== "string") return false;
  if (r.initiator !== "local" && r.initiator !== "remote") return false;
  if (!KNOWN_OUTCOMES.includes(r.outcome as FedosDirectRatchetSessionResetOutcome)) return false;
  if (typeof r.recordedAt !== "number" || !Number.isFinite(r.recordedAt)) return false;
  return true;
}

export function encodeFedosDirectRatchetSessionResetRecordV1(record: FedosDirectRatchetSessionResetRecordV1): string {
  return JSON.stringify(record);
}

/** `null` (never throws) for invalid JSON or a structurally malformed record — fail closed. */
export function decodeFedosDirectRatchetSessionResetRecordV1(line: string): FedosDirectRatchetSessionResetRecordV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosDirectRatchetSessionResetRecordV1(parsed) ? parsed : null;
}
