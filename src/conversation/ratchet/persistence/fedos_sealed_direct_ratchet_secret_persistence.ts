/**
 * Secure Runtime Alpha 5401-5480 — Phase G: the dedicated sealed
 * ratchet-secret persistence port. Modeled on the Sender-Key
 * sealed-persistence lineage's own precedent
 * (`arc/sender-key-secret-persistence-restart-recovery`, read-only
 * reference only): insert-only, write-once-per-key, no update/delete of
 * any kind. Deliberately NOT the generic Sync Journal, NOT Archive, NOT
 * Search -- this Arc's own Absolute Prohibitions and Phase J structural
 * guards forbid reusing any of those for secret-bearing state.
 */
import type { FedosSealedDirectRatchetSecretRecordV1 } from "../fedos_sealed_direct_ratchet_secret_record.js";

export type FedosSealedDirectRatchetSecretPersistenceWriteResult = "written" | "already-present" | "conflict" | "failed";

export interface FedosSealedDirectRatchetSecretPersistence {
  /** Keyed by `fedosSealedDirectRatchetSecretRecordKey(record)` (`../fedos_sealed_direct_ratchet_secret_record.ts`). Never overwrites an existing key -- a second write attempt with different content is `"conflict"`; identical content is idempotent `"already-present"`. */
  putSealedSecret(record: FedosSealedDirectRatchetSecretRecordV1): FedosSealedDirectRatchetSecretPersistenceWriteResult;
  getSealedSecret(recordKey: string): FedosSealedDirectRatchetSecretRecordV1 | null;
  listSealedSecrets(): readonly FedosSealedDirectRatchetSecretRecordV1[];
}
