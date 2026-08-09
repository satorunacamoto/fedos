/**
 * Secure Runtime Alpha 1336 — append-only `FedosGroupDirectPathPersistence`
 * backend. Mirrors `AppendOnlyFedosConversationActivationPersistence`'s own
 * NDJSON, insert-only, fail-closed-on-conflict convention (Alpha 1121).
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosGroupDirectPathRecordKey,
  fedosGroupDirectPathRecordsAreEqual,
  resolveCurrentGroupDirectPathRecord,
  type FedosGroupDirectPathPersistence,
  type FedosGroupDirectPathPersistenceWriteResult,
  type FedosGroupDirectPathRecord,
} from "./fedos_group_direct_path.js";

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

function replayLog(filePath: string): FedosGroupDirectPathRecord[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosGroupDirectPathRecord>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosGroupDirectPathRecord;
    const key = fedosGroupDirectPathRecordKey(parsed.pathId, parsed.state);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosGroupDirectPathRecordsAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosGroupDirectPathPersistence: conflicting duplicate records for key "${key}" found in log file.`);
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosGroupDirectPathPersistence implements FedosGroupDirectPathPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putPathFact(record: FedosGroupDirectPathRecord): FedosGroupDirectPathPersistenceWriteResult {
    const key = fedosGroupDirectPathRecordKey(record.pathId, record.state);
    const existing = replayLog(this.#filePath).find((r) => fedosGroupDirectPathRecordKey(r.pathId, r.state) === key) ?? null;
    if (existing !== null) {
      return fedosGroupDirectPathRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getPath(pathId: string): FedosGroupDirectPathRecord | null {
    return resolveCurrentGroupDirectPathRecord(replayLog(this.#filePath).filter((r) => r.pathId === pathId));
  }

  listPathsForGeneration(groupConversationId: string, generationId: string): readonly FedosGroupDirectPathRecord[] {
    const scoped = replayLog(this.#filePath).filter(
      (r) => r.groupConversationId === groupConversationId && r.generationId === generationId,
    );
    const byPathId = new Map<string, FedosGroupDirectPathRecord[]>();
    for (const record of scoped) {
      const list = byPathId.get(record.pathId) ?? [];
      list.push(record);
      byPathId.set(record.pathId, list);
    }
    const result: FedosGroupDirectPathRecord[] = [];
    for (const facts of byPathId.values()) {
      const current = resolveCurrentGroupDirectPathRecord(facts);
      if (current !== null) result.push(current);
    }
    return result;
  }
}
