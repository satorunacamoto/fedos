/**
 * Secure Runtime Alpha 3161–3240 ("Account-to-Device Signature Verification
 * Boundary") — Phase F/I: Replay Persistence Port.
 *
 * Mirrors `../fedos_device_registry_persistence.ts`'s own port shape exactly
 * (Alpha 2921–3000, Phase D), applied to consumed-challenge facts instead of
 * Device Binding events. A DELIBERATELY SEPARATE port and file tree from the
 * Device Registry itself — a consumed-challenge fact is not a Device Binding
 * fact, and this Arc's own instruction is explicit: do not overload Sync
 * Journal, and add a separate replay store rather than distort the Registry's
 * own event model.
 */

import {
  fedosDeviceBindingChallengeConsumptionKey,
  fedosPersistedDeviceBindingChallengeConsumptionRecordsAreEqual,
  type FedosPersistedDeviceBindingChallengeConsumptionV1,
} from "./fedos_persisted_device_binding_challenge_consumption_v1.js";

/** Mirrors `FedosDeviceRegistryPersistenceWriteResult` exactly. */
export type FedosDeviceBindingChallengeReplayWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosDeviceBindingChallengeReplayPersistence {
  putConsumption(record: FedosPersistedDeviceBindingChallengeConsumptionV1): FedosDeviceBindingChallengeReplayWriteResult;
  getConsumption(nonce: string): FedosPersistedDeviceBindingChallengeConsumptionV1 | null;
}

export { fedosDeviceBindingChallengeConsumptionKey, fedosPersistedDeviceBindingChallengeConsumptionRecordsAreEqual };
