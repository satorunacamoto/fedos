/**
 * Secure Runtime Alpha 2421–2500 ("Multi Device Synchronization
 * Foundation") — Sync Journal.
 *
 * The single, append-only, per-account source of truth for "what
 * changed" — every other primitive in this Arc (Sync Cursor, Sync
 * Queue, Pending Changes, Sync State) reads FROM this journal, never
 * maintains a second copy of its own. An entry carries only an OPAQUE
 * `contentHash` reference to the change's real (already-encrypted)
 * content, which lives in this codebase's existing conversation
 * envelope/payload ports (Alpha 854/858, 803/804/806) — this file
 * never carries plaintext or ciphertext bytes, and never re-implements
 * envelope encryption. This is explicitly NOT a transport: nothing
 * here performs network I/O.
 *
 * Sequence numbers are assigned monotonically starting at 1, in
 * append order, and never reused or reassigned — this is the ordering
 * every Sync Cursor position is measured against.
 *
 * `changeId` de-duplication is a HARD invariant of this file: the same
 * `changeId` appended twice (e.g. a retried local write before the
 * first attempt was acknowledged) never produces a second entry or a
 * second sequence number — `append()` reports `"duplicate"` and
 * returns the ORIGINAL entry unchanged.
 *
 * HARD GUARDRAILS:
 *   - No `delete`/rewrite method — append-only, matches this
 *     codebase's own existing Absolute Prohibition on deletion.
 *   - Never throws.
 *
 * Secure Runtime Alpha 4581–4660 ("Desktop Device Registration, Pairing, and
 * Durable Sync Journal Arc") — Phase F: OPTIONAL durable backend. This
 * class's own accepted business semantics (dedup-by-`changeId`, monotonic
 * sequence, never throws, append-only) are UNCHANGED. An OPTIONAL,
 * caller-injected `FedosSyncJournalPersistence`
 * (`./persistence/fedos_sync_journal_persistence.ts`) is consulted ONLY at
 * construction (to hydrate `#entries`/`#byChangeId` from durable storage,
 * restart-safe — a corrupt/conflicting durable log throws out of the
 * constructor itself, mirroring `startFedosDesktopRuntime()`'s own existing
 * "convert a corrupt log into a thrown Error" discipline for every other
 * durable backend it assembles) and on every successful `append()`
 * (write-through, so a durable backend never diverges from this instance's
 * own in-memory state). Omitted (every pre-existing call site), this class
 * behaves EXACTLY as it always has — a pure in-memory ledger, no filesystem
 * touched, no behavioral change whatsoever. A write-through failure (e.g.
 * disk full) is reported as the NEW `"failed"` outcome below WITH the
 * already-assigned `entry` still attached (the in-memory append itself
 * always succeeds; only durability may fail) — a caller such as
 * `FedosSyncState.recordLocalChange()` treats `"failed"` as "do not yet fan
 * out to other devices," never silently claiming durability that did not
 * happen.
 */

import type { FedosSyncJournalPersistence } from "./persistence/fedos_sync_journal_persistence.js";

export type FedosSyncChangeKind = "upsert" | "tombstone";

export interface FedosSyncJournalEntryV1 {
  readonly sequence: number;
  readonly changeId: string;
  readonly accountRef: string;
  readonly originDeviceRef: string;
  readonly conversationId: string;
  readonly kind: FedosSyncChangeKind;
  readonly contentHash: string;
  readonly recordedAt: number;
}

/** `"failed"` (Alpha 4581–4660) — the in-memory append succeeded but the injected durable backend's write did not; `entry` is still populated. */
export type FedosSyncJournalAppendOutcome = "appended" | "duplicate" | "failed";

export interface FedosSyncJournalAppendResult {
  readonly outcome: FedosSyncJournalAppendOutcome;
  readonly entry: FedosSyncJournalEntryV1;
}

export class FedosSyncJournal {
  readonly #entries: FedosSyncJournalEntryV1[] = [];
  readonly #byChangeId = new Map<string, FedosSyncJournalEntryV1>();
  readonly #persistence: FedosSyncJournalPersistence | undefined;

  /** `persistence` is OPTIONAL — omitted, this class is a pure in-memory ledger, byte-for-byte the same as before this Arc (see this file's own header). */
  constructor(persistence?: FedosSyncJournalPersistence) {
    this.#persistence = persistence;
    if (persistence === undefined) return;
    // Restart hydration: replay every durably-recorded entry, in the SAME
    // ascending-sequence order the backend's own `listEntries()` already
    // guarantees (see `./persistence/append_only_fedos_sync_journal_persistence.ts`'s
    // own header) -- a corrupt/conflicting durable log throws here, never
    // silently drops a record.
    for (const entry of persistence.listEntries()) {
      this.#entries.push(entry);
      this.#byChangeId.set(entry.changeId, entry);
    }
  }

  append(input: Omit<FedosSyncJournalEntryV1, "sequence">): FedosSyncJournalAppendResult {
    const existing = this.#byChangeId.get(input.changeId);
    if (existing !== undefined) {
      return { outcome: "duplicate", entry: existing };
    }
    const entry: FedosSyncJournalEntryV1 = { ...input, sequence: this.#entries.length + 1 };
    this.#entries.push(entry);
    this.#byChangeId.set(entry.changeId, entry);
    if (this.#persistence !== undefined) {
      const writeResult = this.#persistence.putEntry(entry);
      if (writeResult === "failed" || writeResult === "conflict") {
        return { outcome: "failed", entry };
      }
    }
    return { outcome: "appended", entry };
  }

  getByChangeId(changeId: string): FedosSyncJournalEntryV1 | null {
    return this.#byChangeId.get(changeId) ?? null;
  }

  /** Every entry with `sequence` strictly greater than `cursorSequence`, in ascending order. */
  readFrom(cursorSequence: number): readonly FedosSyncJournalEntryV1[] {
    return this.#entries.filter((entry) => entry.sequence > cursorSequence);
  }

  readAll(): readonly FedosSyncJournalEntryV1[] {
    return [...this.#entries];
  }

  latestSequence(): number {
    return this.#entries.at(-1)?.sequence ?? 0;
  }
}
