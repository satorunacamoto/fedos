/**
 * Own-Device Sync Protocol Final Closure arc — the Journal Batch payload:
 * the "Job 2" (application-data, fact-log) sibling of
 * `../sync_session/fedos_device_sync_session.ts`'s own "Job 1" (Device
 * Registry, whole-snapshot) payload. Carries a contiguous, ordered slice
 * of ONE source Device's own `FedosSyncJournalEntryV1[]`
 * (`../../sync/fedos_sync_journal_entry.ts`, UNMODIFIED) for
 * `[fromSequence, toSequence]` — exactly the range
 * `FedosDeviceSyncScheduler`'s own `FedosDeviceSyncAttemptRequest`
 * (`../sync_scheduler/fedos_device_sync_attempt.ts`, UNMODIFIED) already
 * names.
 *
 * ORDERING GUARANTEE (load-bearing — see
 * `docs/reviews/fedos-own-device-sync-final/05_TRANSPORT_IMPLEMENTATION_EVIDENCE.md`
 * for the real, test-proven finding this exists to close): a real
 * two-`FedosSyncState`-instance test proved that the receiving Device's
 * own local Journal RE-NUMBERS entries by arrival order, not the sender's
 * original order — so a transport that could deliver entries out of
 * order would silently risk applying a sender's own later change before
 * its own earlier one for the SAME conversation. `entries` here is
 * REQUIRED to be sorted ascending by `sequence` and validated as gapless
 * (`entries[i].sequence === fromSequence + i`) — the one guarantee this
 * file's own validator enforces so every consumer (the outbound
 * coordinator that builds it, the inbound handler that applies it) can
 * rely on "apply `entries` in array order" being equivalent to "apply in
 * the sender's own real chronological order," without needing its own
 * per-conversation ordering logic.
 *
 * Every entry's own `contentHash` remains OPAQUE (unchanged from the
 * Sync Journal's own Alpha 2421–2500 discipline) — this file never
 * carries plaintext or ciphertext content, only the same safe
 * routing/reference facts the Journal itself already carries. No secret
 * material of any kind.
 */

import type { FedosSyncJournalEntryV1, FedosSyncChangeKind } from "../../sync/fedos_sync_journal.js";

export const FEDOS_DEVICE_SYNC_JOURNAL_BATCH_SCHEMA_VERSION = 1 as const;

const CHANGE_KINDS: readonly FedosSyncChangeKind[] = ["upsert", "tombstone"];
const CONTENT_HASH_HEX_PATTERN = /^[0-9a-f]{1,128}$/;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,256}$/;
/** Mirrors the Registry-sync Job 1 batch cap (`FEDOS_DEVICE_RELAY_SYNC_MAX_CONTENT_BYTES`'s own sibling limit) -- a Journal Batch is small (opaque references only, never content), so a generous-but-bounded entry count refuses an oversized/DoS-shaped batch without constraining ordinary use. */
export const FEDOS_DEVICE_SYNC_JOURNAL_BATCH_MAX_ENTRIES = 500;

export interface FedosDeviceSyncJournalBatchV1 {
  readonly schemaVersion: 1;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly fromSequence: number;
  readonly toSequence: number;
  readonly preparedAt: number;
  readonly expiresAt: number;
  /** Ascending by `sequence`, gapless from `fromSequence` to `toSequence` -- see this file's own header for why this is a validated invariant, not a convention. */
  readonly entries: readonly FedosSyncJournalEntryV1[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isWellFormedJournalEntry(candidate: unknown): candidate is FedosSyncJournalEntryV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  if (Object.keys(value).length !== 8) return false;
  if (typeof value.sequence !== "number" || !Number.isInteger(value.sequence) || value.sequence <= 0) return false;
  if (!isNonEmptyString(value.changeId)) return false;
  if (!isNonEmptyString(value.accountRef)) return false;
  if (!isNonEmptyString(value.originDeviceRef)) return false;
  if (!isNonEmptyString(value.conversationId)) return false;
  if (!CHANGE_KINDS.includes(value.kind as FedosSyncChangeKind)) return false;
  if (typeof value.contentHash !== "string" || !CONTENT_HASH_HEX_PATTERN.test(value.contentHash)) return false;
  if (!isValidUnixSeconds(value.recordedAt)) return false;
  return true;
}

/**
 * Structural + ordering validation only -- does NOT check Device Registry
 * trust, does NOT decrypt anything (there is nothing to decrypt here; the
 * batch itself is what gets sealed one layer up by
 * `fedos_device_sync_journal_package_encryption.ts`). Fails closed;
 * never throws. The ordering/gaplessness check is this file's own real
 * security property (see header) -- a batch failing it is REJECTED here,
 * before any entry is ever journaled locally.
 */
export function isWellFormedFedosDeviceSyncJournalBatchV1(candidate: unknown): candidate is FedosDeviceSyncJournalBatchV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== 10) return false;
  if (value.schemaVersion !== FEDOS_DEVICE_SYNC_JOURNAL_BATCH_SCHEMA_VERSION) return false;
  if (!isNonEmptyString(value.accountAuthority)) return false;
  if (!isNonEmptyString(value.accountPublicIdentifier)) return false;
  if (!isNonEmptyString(value.sourceDeviceId) || !DEVICE_ID_PATTERN.test(value.sourceDeviceId)) return false;
  if (!isNonEmptyString(value.targetDeviceId) || !DEVICE_ID_PATTERN.test(value.targetDeviceId)) return false;
  if (typeof value.fromSequence !== "number" || !Number.isInteger(value.fromSequence) || value.fromSequence <= 0) return false;
  if (typeof value.toSequence !== "number" || !Number.isInteger(value.toSequence) || value.toSequence < value.fromSequence) return false;
  if (!isValidUnixSeconds(value.preparedAt)) return false;
  if (!isValidUnixSeconds(value.expiresAt) || (value.expiresAt as number) <= (value.preparedAt as number)) return false;
  if (!Array.isArray(value.entries)) return false;
  if (value.entries.length === 0) return false;
  if (value.entries.length > FEDOS_DEVICE_SYNC_JOURNAL_BATCH_MAX_ENTRIES) return false;
  if (value.entries.length !== (value.toSequence as number) - (value.fromSequence as number) + 1) return false;
  if (!value.entries.every(isWellFormedJournalEntry)) return false;
  for (let i = 0; i < value.entries.length; i += 1) {
    const entry = value.entries[i] as FedosSyncJournalEntryV1;
    if (entry.sequence !== (value.fromSequence as number) + i) return false; // gapless, ascending -- the real ordering guarantee
    if (entry.originDeviceRef !== value.sourceDeviceId) return false; // every entry genuinely originates from the claimed source device
  }
  return true;
}

export function isFedosDeviceSyncJournalBatchExpired(batch: FedosDeviceSyncJournalBatchV1, now: number): boolean {
  return now > batch.expiresAt;
}
