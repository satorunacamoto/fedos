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
 */

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

export type FedosSyncJournalAppendOutcome = "appended" | "duplicate";

export interface FedosSyncJournalAppendResult {
  readonly outcome: FedosSyncJournalAppendOutcome;
  readonly entry: FedosSyncJournalEntryV1;
}

export class FedosSyncJournal {
  readonly #entries: FedosSyncJournalEntryV1[] = [];
  readonly #byChangeId = new Map<string, FedosSyncJournalEntryV1>();

  append(input: Omit<FedosSyncJournalEntryV1, "sequence">): FedosSyncJournalAppendResult {
    const existing = this.#byChangeId.get(input.changeId);
    if (existing !== undefined) {
      return { outcome: "duplicate", entry: existing };
    }
    const entry: FedosSyncJournalEntryV1 = { ...input, sequence: this.#entries.length + 1 };
    this.#entries.push(entry);
    this.#byChangeId.set(entry.changeId, entry);
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
