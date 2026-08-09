/**
 * Secure Runtime Alpha 3721–3800 — In-Memory Conflict Persistence.
 * One record per `conflictId`, last-write-wins on re-observation (never
 * clearing an existing `resolved` state).
 */

import type { FedosDeviceSyncConflictPersistence, FedosDeviceSyncConflictRecordV1, FedosDeviceSyncConflictResolutionAction } from "./fedos_device_sync_conflict_persistence.js";

export class InMemoryFedosDeviceSyncConflictPersistence implements FedosDeviceSyncConflictPersistence {
  readonly #records = new Map<string, FedosDeviceSyncConflictRecordV1>();

  observe(record: FedosDeviceSyncConflictRecordV1): void {
    const existing = this.#records.get(record.conflictId);
    if (existing === undefined) {
      this.#records.set(record.conflictId, record);
      return;
    }
    this.#records.set(record.conflictId, {
      ...existing,
      lastObservedAt: Math.max(existing.lastObservedAt, record.lastObservedAt),
    });
  }

  resolve(conflictId: string, action: FedosDeviceSyncConflictResolutionAction, resolvedAt: number): boolean {
    const existing = this.#records.get(conflictId);
    if (existing === undefined || existing.resolved) return false;
    this.#records.set(conflictId, { ...existing, resolved: true, resolutionAction: action, resolvedAt });
    return true;
  }

  get(conflictId: string): FedosDeviceSyncConflictRecordV1 | null {
    return this.#records.get(conflictId) ?? null;
  }

  listUnresolved(): readonly FedosDeviceSyncConflictRecordV1[] {
    return this.listAll().filter((record) => !record.resolved);
  }

  listAll(): readonly FedosDeviceSyncConflictRecordV1[] {
    return [...this.#records.values()];
  }
}
