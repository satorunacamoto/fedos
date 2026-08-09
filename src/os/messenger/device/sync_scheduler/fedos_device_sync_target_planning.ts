/**
 * Secure Runtime Alpha 3721–3800 — Target Planning (Phase E).
 *
 * For each cycle: (1) query trusted Devices from the LIVE Device Registry,
 * (2) exclude the local source Device, (3) exclude revoked/unavailable
 * Devices (both handled by the SAME `trustState === "trusted"` filter),
 * (4) read each target's own Sync Cursor, (5) construct the minimum
 * eligible range (`cursor.sequence + 1` .. the lesser of the Journal's own
 * latest sequence and the configured range cap), (6) never inspects
 * record CONTENT at all — allowlist enforcement stays exactly where it
 * already lives (`reviewFedosSyncRecordForJournal()` at origin,
 * `fedos_device_sync_conflict.ts` at import) — this file only reasons
 * about opaque sequence numbers, (7) enforces `maxTargetDevicesPerCycle`,
 * (8) produces a deterministic plan (sorted by `targetDeviceId`).
 *
 * Never infers "online" status from anything but a real signal this file
 * has no access to — every currently-trusted, non-source Device with a
 * non-empty pending range is planned, regardless of presumed
 * reachability; an offline target remains eligible for mailbox-style
 * Relay delivery exactly as Alpha 3641–3720 already proves.
 */

import type { FedosDeviceRegistryPersistence } from "../../../../device/persistence/fedos_device_registry_persistence.js";
import type { FedosDeviceBindingAccountRef } from "../../../../device/fedos_device_binding.js";
import type { FedosSyncState } from "../../../../sync/fedos_sync_state.js";
import type { FedosDeviceSyncResourceLimits } from "../../../../device/sync_scheduler/fedos_device_sync_resource_limits.js";

export interface FedosDeviceSyncTargetPlan {
  readonly targetDeviceId: string;
  readonly fromSequence: number;
  readonly toSequence: number;
}

export interface FedosDeviceSyncTargetPlanningDeps {
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly accountRef: FedosDeviceBindingAccountRef;
  readonly sourceDeviceId: string;
  readonly syncState: FedosSyncState;
  readonly limits: FedosDeviceSyncResourceLimits;
}

function latestJournalSequence(syncState: FedosSyncState): number {
  let latest = 0;
  for (const entry of syncState.journalEntries()) {
    if (entry.sequence > latest) latest = entry.sequence;
  }
  return latest;
}

export function planFedosDeviceSyncTargets(deps: FedosDeviceSyncTargetPlanningDeps): readonly FedosDeviceSyncTargetPlan[] {
  const latestSequence = latestJournalSequence(deps.syncState);

  const eligibleDeviceIds = deps.registryPersistence
    .listBindingsForAccount(deps.accountRef.authority, deps.accountRef.publicIdentifier)
    .filter((binding) => binding.trustState === "trusted" && binding.deviceId !== deps.sourceDeviceId)
    .map((binding) => binding.deviceId)
    .sort()
    .slice(0, deps.limits.maxTargetDevicesPerCycle);

  const plans: FedosDeviceSyncTargetPlan[] = [];
  for (const targetDeviceId of eligibleDeviceIds) {
    const cursorSequence = deps.syncState.getCursor(targetDeviceId).sequence;
    const fromSequence = cursorSequence + 1;
    if (fromSequence > latestSequence) continue; // nothing pending for this target
    const toSequence = Math.min(latestSequence, fromSequence + deps.limits.maxJournalRecordsPerRange - 1);
    plans.push({ targetDeviceId, fromSequence, toSequence });
  }
  return plans;
}
