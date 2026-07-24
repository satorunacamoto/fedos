/**
 * Secure Runtime Alpha 609 ("Delivery Observation Persistence
 * Decision") — Stage 9 of the Alpha 601–620 Desktop Local Runtime
 * Entry Point & Publish Pipeline Ownership Arc.
 *
 * The first real durable `FedosDeliveryObservationPersistence`
 * (`./fedos_delivery_observation_persistence.js`, Alpha 464, port
 * UNCHANGED) — implemented using ONLY Node's built-in `node:fs`,
 * mirroring `AppendOnlyFedosBoardOutboxPersistence`
 * (`../outbox/append_only_fedos_board_outbox_persistence.ts`, Alpha
 * 418) field-for-field: same JSON-Lines record format, same
 * append-only semantics, same replay-on-every-call reading strategy,
 * same inserted/already-present/conflict/failed conflict handling,
 * same fail-closed crash/corruption discipline (an unparsable or
 * schema-conflicting line THROWS on replay — never silently repaired
 * or dropped).
 *
 * This log is COMPLETELY INDEPENDENT of the Board-post and Outbox
 * append-only logs — a separate file, a separate schema, a separate
 * class. Existing WITHOUT this file, before this Arc,
 * `FedosDeliveryObservationPersistence` had exactly ONE implementation
 * (`InMemoryFedosDeliveryObservationPersistence`, Alpha 465) —
 * confirmed by repository-wide search (Alpha 609) — meaning every
 * prior Arc's own "durable Observation history" claim (Alpha 581–600)
 * was durable only WITHIN one process's own lifetime, never across a
 * real restart, unless a caller happened to inject a durable backend
 * that did not yet exist. This file closes that gap, honestly, for the
 * FIRST real local caller (Alpha 606) this repository has.
 *
 * HARD GUARDRAILS:
 *   - `AppendOnlyFedosDeliveryObservationPersistence` is the ONLY
 *     export.
 *   - Implements `FedosDeliveryObservationPersistence` (Alpha 464)
 *     verbatim — NO new method, NO new field on the port.
 *   - The constructor performs NO filesystem I/O of any kind — it only
 *     stores the given file path.
 *   - NO external dependency — `node:fs` only, reached the same
 *     untyped way `AppendOnlyFedosBoardOutboxPersistence` already does.
 *   - NO compression, NO binary format, NO write batching.
 *   - NO automatic repair of any kind, ever.
 *   - NO default file path — the caller always supplies one; nothing
 *     in this file selects a Host filesystem path.
 *   - NO Scheduler, Retry Registry, Retry Query, Publisher, Relay,
 *     Nostr, Ontology, or `p2p/` import of any kind — Observation
 *     persistence stays exactly as protocol/layer-neutral as its own
 *     unchanged port already requires.
 *
 * Secure Runtime Alpha 7881–7960 ("FedOS Delivery Observation Durable
 * Write Index" Stage 2) NARROWLY relaxes exactly ONE of the guardrails
 * above: this class now holds a single, LAZILY built, private
 * `id -> record` `Map` (`#index`), closing a real measured O(T)-per-call
 * defect (`docs/secure_runtime_alpha_7881_7960_write_index_design_and_crash_consistency.md`)
 * where every `putObservation`/`getObservation`/`listObservations` call
 * re-read and re-parsed the ENTIRE durable log. The durable append-only
 * log on disk remains the SOLE source of truth: `#index` is never
 * serialized, never written to disk, always fully rebuildable from the
 * log alone, and only ever updated AFTER a durable `appendFileSync`
 * already succeeded (never before, never on a failed append) — see that
 * same document's Phase E for the exact ordering and crash-consistency
 * argument. A distinct instance already holding a built `#index` will
 * NOT see another instance's concurrent append until reconstructed —
 * the same accepted contract `FedosDeliveryObservationRepository`'s own
 * `#bySubject` index (Alpha 7641–7720) already has.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosPersistedDeliveryObservationRecordsAreEqual,
  type FedosDeliveryObservationPersistence,
  type FedosDeliveryObservationPersistenceWriteResult,
} from "./fedos_delivery_observation_persistence.js";
import type { FedosPersistedDeliveryObservationRecordV1 } from "./fedos_delivery_observation_codec.js";

/** PRIVATE — narrow, dependency-free check for a Node `ENOENT` error, without `@types/node`. */
function isEnoent(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

/**
 * PRIVATE — reads the log file's raw contents. A missing file is NOT
 * corruption: it reads as an empty, freshly-started log (`""`). Any
 * OTHER read failure propagates unmodified — fail closed.
 */
function readLogFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8") as string;
  } catch (err) {
    if (isEnoent(err)) return "";
    throw err;
  }
}

/**
 * PRIVATE — replays the append log into a deduplicated array of
 * records, in on-disk order. Blank lines are skipped. Every non-blank
 * line MUST parse as JSON; a parse failure throws, unconditionally.
 * Two lines sharing the same `id` collapse if structurally identical
 * (`fedosPersistedDeliveryObservationRecordsAreEqual`); otherwise this
 * function throws.
 */
function replayLog(filePath: string): FedosPersistedDeliveryObservationRecordV1[] {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosPersistedDeliveryObservationRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedDeliveryObservationRecordV1;
    const existing = byId.get(parsed.id);
    if (existing === undefined) {
      byId.set(parsed.id, parsed);
    } else if (!fedosPersistedDeliveryObservationRecordsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosDeliveryObservationPersistence: conflicting duplicate records for id "${String(parsed.id)}" found in log file.`,
      );
    }
  }
  return [...byId.values()];
}

export class AppendOnlyFedosDeliveryObservationPersistence implements FedosDeliveryObservationPersistence {
  readonly #filePath: string;

  /**
   * Lazily built, in-memory only. `null` until the first call that needs
   * it. Never serialized. Always exactly reconstructable from the durable
   * log via `replayLog()` alone -- see the class-level comment above.
   */
  #index: Map<string, FedosPersistedDeliveryObservationRecordV1> | null = null;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  /** PRIVATE — builds `#index` from the durable log on first use; returns the cached `Map` on every later call. */
  #ensureIndex(): Map<string, FedosPersistedDeliveryObservationRecordV1> {
    if (this.#index === null) {
      const rebuilt = new Map<string, FedosPersistedDeliveryObservationRecordV1>();
      for (const record of replayLog(this.#filePath)) {
        rebuilt.set(record.id, record);
      }
      this.#index = rebuilt;
    }
    return this.#index;
  }

  putObservation(
    record: FedosPersistedDeliveryObservationRecordV1,
  ): FedosDeliveryObservationPersistenceWriteResult {
    const index = this.#ensureIndex();
    const existing = index.get(record.id) ?? null;
    if (existing !== null) {
      return fedosPersistedDeliveryObservationRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    // Durable append already succeeded above -- only now update the in-memory index, synchronously,
    // with no `await` between the two, so no crash-window can observe one without the other.
    index.set(record.id, record);
    return "inserted";
  }

  getObservation(id: string): FedosPersistedDeliveryObservationRecordV1 | null {
    return this.#ensureIndex().get(id) ?? null;
  }

  listObservations(): readonly FedosPersistedDeliveryObservationRecordV1[] {
    return [...this.#ensureIndex().values()];
  }
}
