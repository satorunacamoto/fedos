/**
 * Secure Runtime Alpha 4581–4660 — Phase F: In-Memory Sync Journal
 * Persistence.
 *
 * Mirrors `../../device/persistence/in_memory_fedos_device_binding_challenge_replay_persistence.ts`'s
 * own private-`Map`-backed convention exactly. This is what
 * `FedosSyncState`/`FedosSyncJournal` already behaved as, implicitly, before
 * this Arc — supplying this class explicitly changes nothing observable, it
 * only makes the "no durability" choice an explicit, injected dependency
 * instead of an unconditional internal default.
 */

import {
  fedosSyncJournalEntriesAreEqual,
  fedosSyncJournalEntryKey,
  type FedosSyncJournalPersistence,
  type FedosSyncJournalPersistenceWriteResult,
} from "./fedos_sync_journal_persistence.js";
import type { FedosSyncJournalEntryV1 } from "../fedos_sync_journal.js";

export class InMemoryFedosSyncJournalPersistence implements FedosSyncJournalPersistence {
  readonly #byChangeId = new Map<string, FedosSyncJournalEntryV1>();

  putEntry(entry: FedosSyncJournalEntryV1): FedosSyncJournalPersistenceWriteResult {
    const key = fedosSyncJournalEntryKey(entry);
    const existing = this.#byChangeId.get(key);
    if (existing === undefined) {
      this.#byChangeId.set(key, entry);
      return "inserted";
    }
    return fedosSyncJournalEntriesAreEqual(existing, entry) ? "already-present" : "conflict";
  }

  listEntries(): readonly FedosSyncJournalEntryV1[] {
    return [...this.#byChangeId.values()].sort((a, b) => a.sequence - b.sequence);
  }
}
