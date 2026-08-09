/**
 * Secure Runtime Alpha 3721–3800 — the Scheduler's own protocol-neutral
 * attempt boundary (Phase B: "It must not own ... Relay identity truth").
 *
 * `FedosDeviceSyncScheduler` (`fedos_device_sync_scheduler.ts`) depends on
 * this NARROW interface only — it never imports, constructs, or reasons
 * about `FedosDeviceRelaySyncOutboundCoordinator`/`FedosConversationRelaySet`/
 * `FedosRelay` directly. A caller (production wiring, or this Arc's own
 * tests) supplies an implementation that drives the EXISTING, unmodified
 * Alpha 3641–3720 Relay Sync Outbound Coordinator; the Scheduler itself
 * stays reusable over ANY transport a future caller might inject instead,
 * mirroring `FedosConversationTransportScheduler`'s own injected
 * `publisher: FedosConversationTransportPublisher` boundary exactly.
 */

import type { FedosDeviceSyncAttemptOutcomeCode } from "../../../../device/sync_scheduler/fedos_device_sync_retry_policy.js";

export interface FedosDeviceSyncAttemptRequest {
  readonly scheduleId: string;
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly fromSequence: number;
  readonly toSequence: number;
  readonly attemptNumber: number;
  readonly transferSessionId: string;
}

export interface FedosDeviceSyncAttemptResult {
  readonly outcome: FedosDeviceSyncAttemptOutcomeCode;
  readonly reason?: string;
}

export type FedosDeviceSyncAttemptFn = (request: FedosDeviceSyncAttemptRequest) => Promise<FedosDeviceSyncAttemptResult>;
