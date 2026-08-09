/**
 * Secure Runtime Alpha 4581–4660 — Phase F: Durable Sync Journal Record
 * Codec.
 *
 * Mirrors `../../device/persistence/fedos_device_binding_challenge_replay_codec.ts`'s
 * own exact discipline: fails closed to `null` on anything malformed,
 * off-schema, or carrying an unrecognized top-level field. Every field of
 * `FedosSyncJournalEntryV1` (`../fedos_sync_journal.ts`) already existed,
 * unmodified, before this Arc — this codec adds no new field and enforces
 * no new business rule, only a durable wire shape for exactly that record.
 */

import type { FedosSyncJournalEntryV1 } from "../fedos_sync_journal.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 1;
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

const RECORD_KEYS: ReadonlySet<string> = new Set([
  "sequence",
  "changeId",
  "accountRef",
  "originDeviceRef",
  "conversationId",
  "kind",
  "contentHash",
  "recordedAt",
]);

/** Fails closed to `null` for any malformed, unrecognized-schema, or corrupt input. Never throws. */
export function deserializeFedosSyncJournalEntry(record: unknown): FedosSyncJournalEntryV1 | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => RECORD_KEYS.has(key)) || keys.length !== RECORD_KEYS.size) return null;

  const value = record as Record<string, unknown>;
  if (!isValidSequence(value.sequence)) return null;
  if (!isNonEmptyString(value.changeId)) return null;
  if (!isNonEmptyString(value.accountRef)) return null;
  if (!isNonEmptyString(value.originDeviceRef)) return null;
  if (!isNonEmptyString(value.conversationId)) return null;
  if (value.kind !== "upsert" && value.kind !== "tombstone") return null;
  if (!isNonEmptyString(value.contentHash)) return null;
  if (!isValidTimestamp(value.recordedAt)) return null;

  return {
    sequence: value.sequence,
    changeId: value.changeId,
    accountRef: value.accountRef,
    originDeviceRef: value.originDeviceRef,
    conversationId: value.conversationId,
    kind: value.kind,
    contentHash: value.contentHash,
    recordedAt: value.recordedAt,
  };
}
