/**
 * Secure Runtime Alpha 2421–2500 ("Multi Device Synchronization
 * Foundation") — Sync Cursor.
 *
 * A per-device position marker into the Sync Journal
 * (`./fedos_sync_journal.ts`): "how far THIS device has synced,"
 * nothing more. A cursor is never decremented — `advance()` always
 * takes the MAX of the current and requested sequence, so a stale or
 * out-of-order call can never roll a device's sync position backward
 * (which would otherwise cause already-applied journal entries to be
 * replayed as if new).
 *
 * HARD GUARDRAILS:
 *   - `advance()` is monotonic-only; never throws.
 *   - A missing cursor reads as sequence `0` (before the journal's
 *     first entry, sequence `1`) rather than `null`/`undefined` — a
 *     brand-new device and the journal's own empty state are both
 *     representable without a special case.
 */

export interface FedosSyncCursor {
  readonly deviceRef: string;
  readonly sequence: number;
  readonly updatedAt: number;
}

export class FedosSyncCursorStore {
  readonly #cursors = new Map<string, FedosSyncCursor>();

  get(deviceRef: string): FedosSyncCursor {
    return this.#cursors.get(deviceRef) ?? { deviceRef, sequence: 0, updatedAt: 0 };
  }

  /** Sets `deviceRef`'s cursor to `max(current sequence, toSequence)` — never regresses. */
  advance(deviceRef: string, toSequence: number, at: number): FedosSyncCursor {
    const current = this.get(deviceRef);
    const next: FedosSyncCursor = { deviceRef, sequence: Math.max(current.sequence, toSequence), updatedAt: at };
    this.#cursors.set(deviceRef, next);
    return next;
  }

  /** Discards `deviceRef`'s in-memory cursor — models a device process losing its local state (see Recovery State). */
  reset(deviceRef: string): void {
    this.#cursors.delete(deviceRef);
  }

  list(): readonly FedosSyncCursor[] {
    return [...this.#cursors.values()];
  }
}
