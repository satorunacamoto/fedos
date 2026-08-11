/**
 * Secure Runtime Alpha 4581–4660 ("Desktop Device Registration, Pairing, and
 * Durable Sync Journal Arc") — Phase F: Append-Only Sync Journal
 * Persistence.
 *
 * Mirrors `../../device/persistence/append_only_fedos_device_binding_challenge_replay_persistence.ts`'s
 * own NDJSON-backend discipline exactly: independent log file, insert-only,
 * deterministic replay, fail-closed on corruption (one unparseable line, one
 * off-schema line, or one irreconcilable duplicate `changeId`/`sequence`
 * throws unconditionally — "one corrupt record voids the backend," the same
 * precedent this codebase's every other append-only backend already uses),
 * zero new dependency, no compaction/delete/rewrite, no path construction of
 * its own beyond the caller-supplied `filePath`.
 *
 * Restart hydration (Phase F): `FedosSyncJournal` (`../fedos_sync_journal.ts`)
 * calls `listEntries()` exactly once, at construction, when this backend is
 * injected — every entry ever durably appended before a process restart is
 * replayed back into the fresh in-memory `#entries`/`#byChangeId` structures
 * in the SAME ascending-`sequence` order it was originally appended in, so a
 * restarted Runtime's Journal cursor/history is byte-identical to what it
 * was immediately before the restart (Phase L's own "restart preserves
 * eligibility and Journal cursor/history" requirement, at the Journal
 * layer).
 */

import { readFileSync, appendFileSync } from "node:fs";
import { deserializeFedosSyncJournalEntry } from "./fedos_sync_journal_codec.js";
import {
  fedosSyncJournalEntriesAreEqual,
  fedosSyncJournalEntryKey,
  type FedosSyncJournalPersistence,
  type FedosSyncJournalPersistenceWriteResult,
} from "./fedos_sync_journal_persistence.js";
import type { FedosSyncJournalEntryV1 } from "../fedos_sync_journal.js";

function isEnoent(err: unknown): boolean {
  return err !== null && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

function readLogFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8") as string;
  } catch (err) {
    if (isEnoent(err)) return "";
    throw err;
  }
}

/**
 * PRIVATE — replays the append log into a deduplicated, sequence-ordered
 * array. A parse/schema failure, an irreconcilable duplicate `changeId`, OR
 * a duplicate `sequence` number across two DIFFERENT `changeId`s (a
 * corruption this Journal's own monotonic-sequence invariant must never
 * silently tolerate) throws unconditionally — fail-closed on corruption,
 * exactly like every sibling append-only backend in this codebase.
 */
function replayLog(filePath: string): FedosSyncJournalEntryV1[] {
  const contents = readLogFile(filePath);
  const byChangeId = new Map<string, FedosSyncJournalEntryV1>();
  const bySequence = new Map<number, string>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    const parsed = deserializeFedosSyncJournalEntry(parsedJson);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosSyncJournalPersistence: corrupt or schema-invalid record found in log file.");
    }
    const key = fedosSyncJournalEntryKey(parsed);
    const existing = byChangeId.get(key);
    if (existing === undefined) {
      const sequenceOwner = bySequence.get(parsed.sequence);
      if (sequenceOwner !== undefined && sequenceOwner !== key) {
        throw new Error(`AppendOnlyFedosSyncJournalPersistence: sequence ${parsed.sequence} reused by two different changeIds in log file.`);
      }
      byChangeId.set(key, parsed);
      bySequence.set(parsed.sequence, key);
    } else if (!fedosSyncJournalEntriesAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosSyncJournalPersistence: conflicting duplicate records for changeId "${key}" found in log file.`);
    }
  }
  return [...byChangeId.values()].sort((a, b) => a.sequence - b.sequence);
}

export class AppendOnlyFedosSyncJournalPersistence implements FedosSyncJournalPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putEntry(entry: FedosSyncJournalEntryV1): FedosSyncJournalPersistenceWriteResult {
    const key = fedosSyncJournalEntryKey(entry);
    const existing = replayLog(this.#filePath).find((e) => fedosSyncJournalEntryKey(e) === key) ?? null;
    if (existing !== null) {
      return fedosSyncJournalEntriesAreEqual(existing, entry) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(entry) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  listEntries(): readonly FedosSyncJournalEntryV1[] {
    return replayLog(this.#filePath);
  }
}
