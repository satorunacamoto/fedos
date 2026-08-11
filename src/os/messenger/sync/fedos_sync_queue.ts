/**
 * Secure Runtime Alpha 2421–2500 ("Multi Device Synchronization
 * Foundation") — Sync Queue.
 *
 * The durable, per-target-device OUTBOUND delivery queue: when a
 * local change is recorded (Sync State's `recordLocalChange()`), it is
 * fanned out into one queue entry per sibling device. This is
 * deliberately transport-agnostic — mirrors
 * `FedosPrivateTransport`'s own Outbox/Publisher/Scheduler split
 * (`../conversation/transport/`, Alpha 1471–1540) in SPIRIT (a durable
 * queue a transport drains later) but performs no network I/O of its
 * own; a real transport wiring is a future Arc's job, exactly as
 * Private Transport itself was for Envelope delivery.
 *
 * State machine per entry: `"queued"` -> `"delivered"` -> (once the
 * receiving device has resolved it) `"acknowledged"`; `"failed"` is a
 * distinct terminal-but-retryable state a caller can move back to
 * `"queued"` by re-enqueuing (`enqueueForDevice` on an already-known
 * `(targetDeviceRef, changeId)` pair reports `"already-queued"` rather
 * than duplicating the entry).
 *
 * HARD GUARDRAILS:
 *   - No `delete` method.
 *   - No network call, no retry/backoff scheduling — purely a state
 *     store a scheduler could be built on top of later.
 *   - Never throws.
 */

import type { FedosSyncJournalEntryV1 } from "./fedos_sync_journal.js";

export type FedosSyncOutboundQueueEntryState = "queued" | "delivered" | "acknowledged" | "failed";
export type FedosSyncOutboundEnqueueOutcome = "queued" | "already-queued";

export interface FedosSyncOutboundQueueEntry {
  readonly targetDeviceRef: string;
  readonly entry: FedosSyncJournalEntryV1;
  readonly state: FedosSyncOutboundQueueEntryState;
  readonly queuedAt: number;
  readonly updatedAt: number;
}

interface FedosSyncOutboundQueueMutableEntry {
  readonly targetDeviceRef: string;
  readonly entry: FedosSyncJournalEntryV1;
  state: FedosSyncOutboundQueueEntryState;
  readonly queuedAt: number;
  updatedAt: number;
}

function outboundKey(targetDeviceRef: string, changeId: string): string {
  return `${targetDeviceRef}::${changeId}`;
}

function toSnapshot(item: FedosSyncOutboundQueueMutableEntry): FedosSyncOutboundQueueEntry {
  return { targetDeviceRef: item.targetDeviceRef, entry: item.entry, state: item.state, queuedAt: item.queuedAt, updatedAt: item.updatedAt };
}

export class FedosSyncOutboundQueue {
  readonly #entries = new Map<string, FedosSyncOutboundQueueMutableEntry>();

  enqueueForDevice(targetDeviceRef: string, entry: FedosSyncJournalEntryV1, at: number): FedosSyncOutboundEnqueueOutcome {
    const key = outboundKey(targetDeviceRef, entry.changeId);
    if (this.#entries.has(key)) return "already-queued";
    this.#entries.set(key, { targetDeviceRef, entry, state: "queued", queuedAt: at, updatedAt: at });
    return "queued";
  }

  markDelivered(targetDeviceRef: string, changeId: string, at: number): boolean {
    return this.#transition(targetDeviceRef, changeId, "delivered", at);
  }

  markAcknowledged(targetDeviceRef: string, changeId: string, at: number): boolean {
    return this.#transition(targetDeviceRef, changeId, "acknowledged", at);
  }

  markFailed(targetDeviceRef: string, changeId: string, at: number): boolean {
    return this.#transition(targetDeviceRef, changeId, "failed", at);
  }

  listForDevice(targetDeviceRef: string): readonly FedosSyncOutboundQueueEntry[] {
    return [...this.#entries.values()].filter((item) => item.targetDeviceRef === targetDeviceRef).map(toSnapshot);
  }

  /** Entries still needing (re)delivery — `"queued"` or `"failed"`. Models a device that is currently offline. */
  listPendingForDevice(targetDeviceRef: string): readonly FedosSyncOutboundQueueEntry[] {
    return this.listForDevice(targetDeviceRef).filter((item) => item.state === "queued" || item.state === "failed");
  }

  listDeliveredForDevice(targetDeviceRef: string): readonly FedosSyncOutboundQueueEntry[] {
    return this.listForDevice(targetDeviceRef).filter((item) => item.state === "delivered");
  }

  #transition(targetDeviceRef: string, changeId: string, state: FedosSyncOutboundQueueEntryState, at: number): boolean {
    const item = this.#entries.get(outboundKey(targetDeviceRef, changeId));
    if (item === undefined) return false;
    item.state = state;
    item.updatedAt = at;
    return true;
  }
}
