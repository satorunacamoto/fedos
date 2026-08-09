/**
 * Secure Runtime Alpha 3161–3240 ("Account-to-Device Signature Verification
 * Boundary") — Phase F/I: In-Memory Replay Persistence.
 *
 * Mirrors `./in_memory_fedos_device_registry_persistence.ts`'s own private-
 * `Map<key, record>`-backed convention exactly.
 */

import {
  fedosDeviceBindingChallengeConsumptionKey,
  fedosPersistedDeviceBindingChallengeConsumptionRecordsAreEqual,
  type FedosDeviceBindingChallengeReplayPersistence,
  type FedosDeviceBindingChallengeReplayWriteResult,
} from "../../../../device/persistence/fedos_device_binding_challenge_replay_persistence.js";
import type { FedosPersistedDeviceBindingChallengeConsumptionV1 } from "../../../../device/persistence/fedos_persisted_device_binding_challenge_consumption_v1.js";

export class InMemoryFedosDeviceBindingChallengeReplayPersistence implements FedosDeviceBindingChallengeReplayPersistence {
  readonly #records = new Map<string, FedosPersistedDeviceBindingChallengeConsumptionV1>();

  putConsumption(record: FedosPersistedDeviceBindingChallengeConsumptionV1): FedosDeviceBindingChallengeReplayWriteResult {
    const key = fedosDeviceBindingChallengeConsumptionKey(record);
    const existing = this.#records.get(key);
    if (existing === undefined) {
      this.#records.set(key, record);
      return "inserted";
    }
    return fedosPersistedDeviceBindingChallengeConsumptionRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getConsumption(nonce: string): FedosPersistedDeviceBindingChallengeConsumptionV1 | null {
    return this.#records.get(nonce) ?? null;
  }
}
