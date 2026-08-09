/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — In-Memory Device Replacement Persistence. Mirrors
 * `./in_memory_fedos_device_binding_challenge_replay_persistence.ts`'s own
 * private-`Map<key, record>`-backed convention exactly.
 */
import {
  fedosDeviceReplacementRecordKey,
  fedosDeviceReplacementRecordsAreEqual,
  type FedosDeviceReplacementPersistence,
  type FedosDeviceReplacementWriteResult,
} from "./fedos_device_replacement_persistence.js";
import type { FedosDeviceReplacementRecordV1 } from "../fedos_device_replacement_record.js";

export class InMemoryFedosDeviceReplacementPersistence implements FedosDeviceReplacementPersistence {
  readonly #records = new Map<string, FedosDeviceReplacementRecordV1>();

  putReplacement(record: FedosDeviceReplacementRecordV1): FedosDeviceReplacementWriteResult {
    const key = fedosDeviceReplacementRecordKey(record);
    const existing = this.#records.get(key);
    if (existing === undefined) {
      this.#records.set(key, record);
      return "inserted";
    }
    return fedosDeviceReplacementRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getReplacementForOldDevice(oldDeviceId: string): FedosDeviceReplacementRecordV1 | null {
    return this.#records.get(oldDeviceId) ?? null;
  }

  listReplacements(): readonly FedosDeviceReplacementRecordV1[] {
    return [...this.#records.values()];
  }
}
