/**
 * Own-Device Sync Protocol Final Closure arc — canonical
 * serialize/deserialize for `FedosDeviceSyncJournalBatchV1`. Mirrors
 * `../sync_session/fedos_device_sync_session_codec.ts`'s own "deterministic
 * JSON, `null` on any malformed input, never throws" discipline exactly.
 */
import { isWellFormedFedosDeviceSyncJournalBatchV1, type FedosDeviceSyncJournalBatchV1 } from "./fedos_device_sync_journal_batch.js";

export function serializeFedosDeviceSyncJournalBatchToBytes(batch: FedosDeviceSyncJournalBatchV1): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(batch));
}

/** `null` on ANY malformed input -- unparseable JSON, wrong shape, bad ordering. Never throws. */
export function deserializeFedosDeviceSyncJournalBatchFromBytes(bytes: Uint8Array): FedosDeviceSyncJournalBatchV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!isWellFormedFedosDeviceSyncJournalBatchV1(parsed)) return null;
  return Object.freeze({ ...parsed, entries: Object.freeze([...parsed.entries]) });
}
