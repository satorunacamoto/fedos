/** Secure Runtime Alpha 5401-5480 — Phase G: the in-memory `FedosSealedDirectRatchetSecretPersistence` backend. */
import {
  fedosSealedDirectRatchetSecretRecordKey,
  type FedosSealedDirectRatchetSecretRecordV1,
} from "../fedos_sealed_direct_ratchet_secret_record.js";
import type {
  FedosSealedDirectRatchetSecretPersistence,
  FedosSealedDirectRatchetSecretPersistenceWriteResult,
} from "./fedos_sealed_direct_ratchet_secret_persistence.js";

function recordsAreIdenticalByValue(
  a: FedosSealedDirectRatchetSecretRecordV1,
  b: FedosSealedDirectRatchetSecretRecordV1,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export class InMemoryFedosSealedDirectRatchetSecretPersistence implements FedosSealedDirectRatchetSecretPersistence {
  readonly #records = new Map<string, FedosSealedDirectRatchetSecretRecordV1>();

  putSealedSecret(record: FedosSealedDirectRatchetSecretRecordV1): FedosSealedDirectRatchetSecretPersistenceWriteResult {
    const key = fedosSealedDirectRatchetSecretRecordKey(record);
    const existing = this.#records.get(key);
    if (existing !== undefined) {
      return recordsAreIdenticalByValue(existing, record) ? "already-present" : "conflict";
    }
    this.#records.set(key, record);
    return "written";
  }

  getSealedSecret(recordKey: string): FedosSealedDirectRatchetSecretRecordV1 | null {
    return this.#records.get(recordKey) ?? null;
  }

  listSealedSecrets(): readonly FedosSealedDirectRatchetSecretRecordV1[] {
    return [...this.#records.values()];
  }
}
