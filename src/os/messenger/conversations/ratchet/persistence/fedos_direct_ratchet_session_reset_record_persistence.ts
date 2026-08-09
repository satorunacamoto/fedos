/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — Session Reset Record Persistence Port. Mirrors
 * `../../../device/persistence/fedos_device_binding_challenge_replay_persistence.ts`'s
 * own port shape exactly, applied to Session Reset facts instead of
 * Device Binding Challenge consumption facts. A DELIBERATELY SEPARATE
 * port from every existing Direct Ratchet persistence port
 * (`fedos_direct_ratchet_session_persistence.ts`,
 * `fedos_sealed_direct_ratchet_secret_persistence.ts`) — a reset audit
 * fact is not a session-metadata fact and is not a sealed-secret fact.
 */
import {
  fedosDirectRatchetSessionResetRecordKey,
  fedosDirectRatchetSessionResetRecordsAreEqual,
  type FedosDirectRatchetSessionResetRecordV1,
} from "../../../../../conversation/ratchet/fedos_direct_ratchet_session_reset_record.js";

export type FedosDirectRatchetSessionResetRecordWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosDirectRatchetSessionResetRecordPersistence {
  putResetRecord(record: FedosDirectRatchetSessionResetRecordV1): FedosDirectRatchetSessionResetRecordWriteResult;
  getResetRecord(nonce: string): FedosDirectRatchetSessionResetRecordV1 | null;
  listResetRecords(): readonly FedosDirectRatchetSessionResetRecordV1[];
}

export { fedosDirectRatchetSessionResetRecordKey, fedosDirectRatchetSessionResetRecordsAreEqual };
