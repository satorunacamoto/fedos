/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — the Device Replacement audit link.
 *
 * Review §07's own chosen model: a replacement Device is ALWAYS a
 * brand-new Device identity (new `deviceId`, new
 * `FedosDeviceSigningKeypair`, new proof of possession) — this record is
 * PURELY an informational, audit-trail link between the OLD and NEW
 * `deviceId`, never a trust/inheritance mechanism. Nothing reads this
 * record to decide whether the new Device may act — the new Device's own
 * real registration (`FedosDeviceBindingRegistrationAuthority.registerDevice()`)
 * already decided that, independently, before this record is ever
 * written. This record exists ONLY so
 * `../fedos_device_lifecycle.ts`'s own `deriveFedosDeviceLifecycleState()`
 * can distinguish "revoked because replaced" from "revoked with no
 * successor" for a UI/audit surface — it grants no capability.
 */

export type FedosDeviceReplacementReason = "lost" | "stolen" | "compromised" | "destroyed" | "routine";

const KNOWN_REASONS: readonly FedosDeviceReplacementReason[] = ["lost", "stolen", "compromised", "destroyed", "routine"];

export interface FedosDeviceReplacementRecordV1 {
  readonly schemaVersion: 1;
  readonly oldDeviceId: string;
  readonly newDeviceId: string;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly reason: FedosDeviceReplacementReason;
  readonly recordedAt: number;
}

/** Keyed by `oldDeviceId` — one replacement fact per superseded Device; a chain of replacements (A -> B -> C) is expressed as two independent records, never overwritten. */
export function fedosDeviceReplacementRecordKey(record: FedosDeviceReplacementRecordV1): string {
  return record.oldDeviceId;
}

export function fedosDeviceReplacementRecordsAreEqual(
  a: FedosDeviceReplacementRecordV1,
  b: FedosDeviceReplacementRecordV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.oldDeviceId === b.oldDeviceId &&
    a.newDeviceId === b.newDeviceId &&
    a.accountAuthority === b.accountAuthority &&
    a.accountPublicIdentifier === b.accountPublicIdentifier &&
    a.reason === b.reason &&
    a.recordedAt === b.recordedAt
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

const ALL_KNOWN_FIELDS = new Set<string>([
  "schemaVersion",
  "oldDeviceId",
  "newDeviceId",
  "accountAuthority",
  "accountPublicIdentifier",
  "reason",
  "recordedAt",
]);

/** Structural validation only. Fails closed; never throws. */
export function isWellFormedFedosDeviceReplacementRecordV1(candidate: unknown): candidate is FedosDeviceReplacementRecordV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== ALL_KNOWN_FIELDS.size || !keys.every((k) => ALL_KNOWN_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (!isNonEmptyString(r.oldDeviceId)) return false;
  if (!isNonEmptyString(r.newDeviceId)) return false;
  if (r.oldDeviceId === r.newDeviceId) return false;
  if (!isNonEmptyString(r.accountAuthority)) return false;
  if (!isNonEmptyString(r.accountPublicIdentifier)) return false;
  if (!KNOWN_REASONS.includes(r.reason as FedosDeviceReplacementReason)) return false;
  if (typeof r.recordedAt !== "number" || !Number.isFinite(r.recordedAt)) return false;
  return true;
}

export function encodeFedosDeviceReplacementRecordV1(record: FedosDeviceReplacementRecordV1): string {
  return JSON.stringify(record);
}

/** `null` (never throws) for invalid JSON or a structurally malformed record — fail closed. */
export function decodeFedosDeviceReplacementRecordV1(line: string): FedosDeviceReplacementRecordV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosDeviceReplacementRecordV1(parsed) ? parsed : null;
}
