/**
 * The persisted SHAPE of one `FedosSyncJournal` (`./fedos_sync_journal.ts`,
 * Secure Runtime Alpha 2421–2500) entry — split into its own leaf file so
 * `./persistence/fedos_sync_journal_persistence.ts` (Alpha 4581–4660),
 * the durable write-through/hydration Port `FedosSyncJournal` optionally
 * accepts, can depend on this record type WITHOUT depending on
 * `fedos_sync_journal.ts` itself — `fedos_sync_journal.ts` is the file
 * that ACCEPTS a `FedosSyncJournalPersistence` (a real, type-only
 * dependency of its own, needed for its constructor's optional parameter),
 * so the record type it hands that Port cannot keep living there without
 * closing a cycle: `fedos_sync_journal.ts` -> `fedos_sync_journal_persistence.ts`
 * (type, for the Port) -> back to `fedos_sync_journal.ts` (type, for the
 * entry record) was exactly the loop.
 *
 * Nostr Consolidation Plan, Step 5 / architecture cycle detector baseline
 * reduction (`docs/architecture/NOSTR-CONSOLIDATION-PLAN.md`,
 * `test/architecture_cycle_detector.test.ts`) — a dedicated,
 * single-purpose type module, never a mega-types dumping ground: it
 * holds exactly the two declarations `fedos_sync_journal.ts` used to own
 * directly, `FedosSyncChangeKind` and `FedosSyncJournalEntryV1`, and
 * nothing else — every other export (`FedosSyncJournalAppendOutcome`,
 * `FedosSyncJournalAppendResult`, the `FedosSyncJournal` class itself)
 * stays exactly where it was. `fedos_sync_journal.ts` re-exports both
 * names from here unchanged, so its own existing consumers needed zero
 * call-site changes.
 *
 * HARD GUARDRAILS (unchanged from `fedos_sync_journal.ts`'s own, carried
 * forward verbatim for the two declarations that moved):
 *   - This file defines TYPES ONLY — no function, no class, no runtime
 *     behavior of any kind.
 *   - `contentHash` is an OPAQUE reference only — this file never
 *     carries plaintext or ciphertext bytes, and never implies anything
 *     about envelope encryption.
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
