/**
 * Secure Runtime Alpha 4581–4660 ("Desktop Device Registration, Pairing, and
 * Durable Sync Journal Arc") — Phase F: Durable Sync Journal Persistence
 * Port.
 *
 * `FedosSyncJournal` (`../fedos_sync_journal.ts`, Alpha 2421–2500) is, and
 * remains, an in-memory-first append-only ledger — this port is an OPTIONAL
 * write-through/hydration backend a caller may inject into it, never a
 * replacement of its own accepted business semantics (dedup-by-`changeId`,
 * monotonic sequence, never-throws, append-only). Mirrors
 * `../../device/persistence/fedos_device_binding_challenge_replay_persistence.ts`'s
 * own "narrow event-store port, two implementations (in-memory / durable
 * NDJSON)" shape exactly, applied to `FedosSyncJournalEntryV1`
 * (`../fedos_sync_journal.ts`) instead of a replay-consumption record.
 *
 * Every `FedosSyncJournalEntryV1` this Arc's own Phase F backend ever
 * durably stores already carries only what `../fedos_sync_journal.ts`
 * itself already accepted before this Arc touched it: an OPAQUE
 * `contentHash` reference, never plaintext or ciphertext bytes, never a
 * secret. This port neither widens nor narrows that record shape — it only
 * makes it durable.
 */

// Nostr Consolidation Plan, Step 5 / architecture cycle detector baseline
// reduction — sourced from the dedicated `../fedos_sync_journal_entry.ts`
// (not `../fedos_sync_journal.ts`, which ACCEPTS this Port — see that
// shape file's own header for why importing back from here would close
// a cycle). `fedos_sync_journal.ts` re-exports the identical type
// unchanged, so this is a zero-behavior-change redirect.
import type { FedosSyncJournalEntryV1 } from "../fedos_sync_journal_entry.js";

/** Mirrors `FedosDeviceBindingChallengeReplayWriteResult`/`FedosDeviceRegistryPersistenceWriteResult`'s own exact vocabulary. */
export type FedosSyncJournalPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosSyncJournalPersistence {
  /** Durably records one already-sequenced entry. `"already-present"` for a byte-identical duplicate of an existing `changeId`; `"conflict"` for a DIFFERENT entry reusing the same `changeId` OR the same `sequence` — never silently overwritten. */
  putEntry(entry: FedosSyncJournalEntryV1): FedosSyncJournalPersistenceWriteResult;
  /** Every durably recorded entry, deduplicated by `changeId`, in ascending `sequence` order. A backend fails closed (throws) on structurally corrupt or irreconcilably conflicting stored content — see `./append_only_fedos_sync_journal_persistence.ts`'s own header. */
  listEntries(): readonly FedosSyncJournalEntryV1[];
}

/** Keyed by `changeId` alone — `FedosSyncJournal`'s own hard dedup invariant (see `../fedos_sync_journal.ts`'s header). */
export function fedosSyncJournalEntryKey(entry: FedosSyncJournalEntryV1): string {
  return entry.changeId;
}

/** Structural equality over every field — decides `"already-present"` vs `"conflict"` for a duplicate `changeId`. */
export function fedosSyncJournalEntriesAreEqual(a: FedosSyncJournalEntryV1, b: FedosSyncJournalEntryV1): boolean {
  return (
    a.sequence === b.sequence &&
    a.changeId === b.changeId &&
    a.accountRef === b.accountRef &&
    a.originDeviceRef === b.originDeviceRef &&
    a.conversationId === b.conversationId &&
    a.kind === b.kind &&
    a.contentHash === b.contentHash &&
    a.recordedAt === b.recordedAt
  );
}
