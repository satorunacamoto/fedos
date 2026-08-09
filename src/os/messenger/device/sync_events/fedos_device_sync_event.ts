/**
 * Secure Runtime Alpha 4421–4500 ("Desktop Device Sync Badge, Notification,
 * and Operational Event Wiring Arc") — Phase B: the closed Desktop Device
 * Sync Event vocabulary.
 *
 * `FedosDeviceSyncEventKind` is a CLOSED, exhaustive vocabulary of exactly
 * the nine event kinds this Arc's own brief names — no more, mirroring
 * every other closed-vocabulary boundary already established in this
 * codebase (`FedosDesktopNotificationKind`, `FedosDesktopBadgeState`,
 * `FedosDesktopTrayAction`). `FedosDeviceSyncEvent` is a pure, immutable,
 * discriminated-union data shape — no method, no callback, no reference to
 * `FedosDeviceSyncScheduler`/persistence of any kind. It carries only
 * coarse, non-sensitive facts already present on
 * `FedosDeviceSyncAttemptRequest`/`FedosDeviceSyncAttemptResult`
 * (`../sync_scheduler/fedos_device_sync_attempt.ts`) — scheduleId,
 * deviceId, attempt number, coarse outcome code — never Journal content,
 * never a key, never a secret.
 */

import type { FedosDeviceSyncAttemptOutcomeCode } from "../../../../device/sync_scheduler/fedos_device_sync_retry_policy.js";

export type FedosDeviceSyncEventKind =
  | "sync-started"
  | "sync-progress"
  | "sync-completed"
  | "sync-failed"
  | "conflict-detected"
  | "retry-scheduled"
  | "retry-aborted"
  | "device-offline"
  | "device-online";

export const FEDOS_DEVICE_SYNC_EVENT_KINDS: readonly FedosDeviceSyncEventKind[] = [
  "sync-started",
  "sync-progress",
  "sync-completed",
  "sync-failed",
  "conflict-detected",
  "retry-scheduled",
  "retry-aborted",
  "device-offline",
  "device-online",
];

/** Common fields for every event tied to one real Scheduler attempt (every kind except `"device-offline"`/`"device-online"`, which are DERIVED connectivity signals with no single attempt of their own -- see `fedos_device_sync_event_bridge.ts`'s own header). */
export interface FedosDeviceSyncAttemptEventBase {
  readonly at: number;
  readonly scheduleId: string;
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly attemptNumber: number;
}

export type FedosDeviceSyncEvent =
  | (FedosDeviceSyncAttemptEventBase & { readonly kind: "sync-started" })
  | (FedosDeviceSyncAttemptEventBase & { readonly kind: "sync-progress" })
  | (FedosDeviceSyncAttemptEventBase & { readonly kind: "sync-completed" })
  | (FedosDeviceSyncAttemptEventBase & { readonly kind: "sync-failed"; readonly outcome: FedosDeviceSyncAttemptOutcomeCode; readonly reason: string })
  | (FedosDeviceSyncAttemptEventBase & { readonly kind: "conflict-detected"; readonly outcome: FedosDeviceSyncAttemptOutcomeCode })
  | (FedosDeviceSyncAttemptEventBase & { readonly kind: "retry-scheduled"; readonly outcome: FedosDeviceSyncAttemptOutcomeCode })
  | (FedosDeviceSyncAttemptEventBase & { readonly kind: "retry-aborted"; readonly outcome: FedosDeviceSyncAttemptOutcomeCode; readonly reason: string })
  | { readonly kind: "device-offline"; readonly at: number; readonly targetDeviceId: string; readonly reason: string }
  | { readonly kind: "device-online"; readonly at: number; readonly targetDeviceId: string };

/** A caller-supplied sink for translated events -- mirrors this codebase's own established "plain injected callback, never an EventEmitter" idiom (`FedosConversationInboundEnvelopeListener`, `../../conversation/transport/relay/fedos_conversation_inbound_subscription.ts`). Never throws past the Bridge's own boundary; a throwing listener is swallowed (Phase B "Bridge only -- never own business logic", restated as "never let one broken observer break the real Scheduler attempt path"). */
export type FedosDeviceSyncEventListener = (event: FedosDeviceSyncEvent) => void;
