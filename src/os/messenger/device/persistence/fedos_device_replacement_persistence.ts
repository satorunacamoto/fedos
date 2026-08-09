/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — Device Replacement Persistence Port. A DELIBERATELY
 * SEPARATE port from `fedos_device_registry_persistence.ts` — a
 * replacement link is an audit fact ABOUT two Registry entries, never a
 * Registry event itself (mirrors this Arc's own
 * `../../conversation/ratchet/persistence/fedos_direct_ratchet_session_reset_record_persistence.ts`
 * separation of concerns exactly).
 */
import {
  fedosDeviceReplacementRecordKey,
  fedosDeviceReplacementRecordsAreEqual,
  type FedosDeviceReplacementRecordV1,
} from "../../../../device/fedos_device_replacement_record.js";

export type FedosDeviceReplacementWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosDeviceReplacementPersistence {
  putReplacement(record: FedosDeviceReplacementRecordV1): FedosDeviceReplacementWriteResult;
  getReplacementForOldDevice(oldDeviceId: string): FedosDeviceReplacementRecordV1 | null;
  listReplacements(): readonly FedosDeviceReplacementRecordV1[];
}

export { fedosDeviceReplacementRecordKey, fedosDeviceReplacementRecordsAreEqual };
