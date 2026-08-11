/**
 * Secure Runtime Alpha 7721–7800 — the durable, file-backed
 * `FedosArchiveSuppressionObservationPersistence`. Mirrors
 * `AppendOnlyFedosPayloadRetentionPersistence`'s own backend exactly
 * (Alpha 796) — independent log file, NDJSON, insert-only, fail-closed
 * on corruption, no compaction/delete/rewrite, full `replayLog()` on
 * every call (no in-memory cache to go stale across a restart — see
 * Phase A reconciliation report §7).
 */

import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosPersistedArchiveSuppressionObservationsAreEqual,
  type FedosPersistedArchiveSuppressionObservationV1,
} from "./fedos_persisted_archive_suppression_observation_v1.js";
import type {
  FedosArchiveSuppressionObservationPersistence,
  FedosArchiveSuppressionObservationPersistenceWriteResult,
} from "./fedos_archive_suppression_observation_persistence.js";

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

function replayLog(filePath: string): FedosPersistedArchiveSuppressionObservationV1[] {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosPersistedArchiveSuppressionObservationV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedArchiveSuppressionObservationV1;
    const existing = byId.get(parsed.id);
    if (existing === undefined) {
      byId.set(parsed.id, parsed);
    } else if (!fedosPersistedArchiveSuppressionObservationsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosArchiveSuppressionObservationPersistence: conflicting duplicate records for id "${String(parsed.id)}" found in log file.`,
      );
    }
  }
  return [...byId.values()];
}

export class AppendOnlyFedosArchiveSuppressionObservationPersistence implements FedosArchiveSuppressionObservationPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putObservation(record: FedosPersistedArchiveSuppressionObservationV1): FedosArchiveSuppressionObservationPersistenceWriteResult {
    const existing = replayLog(this.#filePath).find((observation) => observation.id === record.id) ?? null;
    if (existing !== null) {
      return fedosPersistedArchiveSuppressionObservationsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getObservation(id: string): FedosPersistedArchiveSuppressionObservationV1 | null {
    return replayLog(this.#filePath).find((observation) => observation.id === id) ?? null;
  }

  listObservationsForSubject(subjectRef: string): readonly FedosPersistedArchiveSuppressionObservationV1[] {
    return replayLog(this.#filePath).filter((observation) => observation.subjectRef === subjectRef);
  }

  listObservations(): readonly FedosPersistedArchiveSuppressionObservationV1[] {
    return replayLog(this.#filePath);
  }
}
