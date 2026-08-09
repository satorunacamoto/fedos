/**
 * Secure Runtime Alpha 3721–3800 — Append-Only Conflict Persistence.
 * Every `observe()`/`resolve()` call appends a FULL, current snapshot
 * line; replay takes the LAST line per `conflictId` as current state --
 * still fail-closed on a corrupt/schema-invalid line, still restart-safe,
 * never reliant on an in-memory-only set.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import { isWellFormedFedosDeviceSyncConflictRecordV1, type FedosDeviceSyncConflictPersistence, type FedosDeviceSyncConflictRecordV1, type FedosDeviceSyncConflictResolutionAction } from "./fedos_device_sync_conflict_persistence.js";

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

/** Replays the log, keeping only the LAST valid snapshot per `conflictId` (later lines overwrite earlier ones for the same key -- this file's own append style, distinct from the insert-only event logs elsewhere in this Arc). A corrupt/schema-invalid line throws unconditionally. */
function replayLog(filePath: string): Map<string, FedosDeviceSyncConflictRecordV1> {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosDeviceSyncConflictRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    if (!isWellFormedFedosDeviceSyncConflictRecordV1(parsedJson)) {
      throw new Error("AppendOnlyFedosDeviceSyncConflictPersistence: corrupt or schema-invalid record found in log file.");
    }
    byId.set(parsedJson.conflictId, Object.freeze({ ...parsedJson }));
  }
  return byId;
}

export class AppendOnlyFedosDeviceSyncConflictPersistence implements FedosDeviceSyncConflictPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  observe(record: FedosDeviceSyncConflictRecordV1): void {
    const existing = replayLog(this.#filePath).get(record.conflictId) ?? null;
    const toWrite: FedosDeviceSyncConflictRecordV1 =
      existing === null ? record : { ...existing, lastObservedAt: Math.max(existing.lastObservedAt, record.lastObservedAt) };
    appendFileSync(this.#filePath, JSON.stringify(toWrite) + "\n", "utf8");
  }

  resolve(conflictId: string, action: FedosDeviceSyncConflictResolutionAction, resolvedAt: number): boolean {
    const existing = replayLog(this.#filePath).get(conflictId) ?? null;
    if (existing === null || existing.resolved) return false;
    const toWrite: FedosDeviceSyncConflictRecordV1 = { ...existing, resolved: true, resolutionAction: action, resolvedAt };
    appendFileSync(this.#filePath, JSON.stringify(toWrite) + "\n", "utf8");
    return true;
  }

  get(conflictId: string): FedosDeviceSyncConflictRecordV1 | null {
    return replayLog(this.#filePath).get(conflictId) ?? null;
  }

  listUnresolved(): readonly FedosDeviceSyncConflictRecordV1[] {
    return this.listAll().filter((record) => !record.resolved);
  }

  listAll(): readonly FedosDeviceSyncConflictRecordV1[] {
    return [...replayLog(this.#filePath).values()];
  }
}
