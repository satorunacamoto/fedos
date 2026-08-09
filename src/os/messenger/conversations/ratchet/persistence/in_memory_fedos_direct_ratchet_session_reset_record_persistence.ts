/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — In-Memory Session Reset Record Persistence. Mirrors
 * `../../../device/persistence/in_memory_fedos_device_binding_challenge_replay_persistence.ts`'s
 * own private-`Map<key, record>`-backed convention exactly.
 */
import {
  fedosDirectRatchetSessionResetRecordKey,
  fedosDirectRatchetSessionResetRecordsAreEqual,
  type FedosDirectRatchetSessionResetRecordPersistence,
  type FedosDirectRatchetSessionResetRecordWriteResult,
} from "../../../../../conversation/ratchet/persistence/fedos_direct_ratchet_session_reset_record_persistence.js";
import type { FedosDirectRatchetSessionResetRecordV1 } from "../../../../../conversation/ratchet/fedos_direct_ratchet_session_reset_record.js";

export class InMemoryFedosDirectRatchetSessionResetRecordPersistence implements FedosDirectRatchetSessionResetRecordPersistence {
  readonly #records = new Map<string, FedosDirectRatchetSessionResetRecordV1>();

  putResetRecord(record: FedosDirectRatchetSessionResetRecordV1): FedosDirectRatchetSessionResetRecordWriteResult {
    const key = fedosDirectRatchetSessionResetRecordKey(record);
    const existing = this.#records.get(key);
    if (existing === undefined) {
      this.#records.set(key, record);
      return "inserted";
    }
    return fedosDirectRatchetSessionResetRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getResetRecord(nonce: string): FedosDirectRatchetSessionResetRecordV1 | null {
    return this.#records.get(nonce) ?? null;
  }

  listResetRecords(): readonly FedosDirectRatchetSessionResetRecordV1[] {
    return [...this.#records.values()];
  }
}
