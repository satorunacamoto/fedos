/**
 * Secure Runtime Alpha 1327 — append-only `FedosGroupGenerationPersistence`
 * backend. Mirrors `AppendOnlyFedosConversationActivationPersistence`'s own
 * NDJSON, insert-only, fail-closed-on-conflict convention exactly (Alpha
 * 1121): independent log file, deterministic replay, no compaction/
 * delete/rewrite, zero new dependency. A malformed line throws
 * unconditionally on replay; a conflicting duplicate `generationId`
 * throws — the same "one corrupt record voids the backend" precedent
 * this codebase already applies everywhere.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  currentGenerationFrom,
  fedosGroupGenerationRecordsAreEqual,
  type FedosGroupGenerationId,
  type FedosGroupGenerationPersistence,
  type FedosGroupGenerationPersistenceWriteResult,
  type FedosGroupGenerationRecord,
} from "../../../../conversation/group/fedos_group_generation.js";

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

function replayLog(filePath: string): FedosGroupGenerationRecord[] {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosGroupGenerationRecord>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosGroupGenerationRecord;
    const existing = byId.get(parsed.generationId);
    if (existing === undefined) {
      byId.set(parsed.generationId, parsed);
    } else if (!fedosGroupGenerationRecordsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosGroupGenerationPersistence: conflicting duplicate records for generationId "${parsed.generationId}" found in log file.`,
      );
    }
  }
  return [...byId.values()];
}

export class AppendOnlyFedosGroupGenerationPersistence implements FedosGroupGenerationPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putGeneration(record: FedosGroupGenerationRecord): FedosGroupGenerationPersistenceWriteResult {
    const existing = replayLog(this.#filePath).find((r) => r.generationId === record.generationId) ?? null;
    if (existing !== null) {
      return fedosGroupGenerationRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getGeneration(generationId: FedosGroupGenerationId): FedosGroupGenerationRecord | null {
    return replayLog(this.#filePath).find((r) => r.generationId === generationId) ?? null;
  }

  currentGenerationForGroup(groupConversationId: string): FedosGroupGenerationRecord | null {
    return currentGenerationFrom(replayLog(this.#filePath).filter((r) => r.groupConversationId === groupConversationId));
  }

  listGenerations(groupConversationId: string): readonly FedosGroupGenerationRecord[] {
    return replayLog(this.#filePath)
      .filter((r) => r.groupConversationId === groupConversationId)
      .sort((a, b) => a.generationNumber - b.generationNumber);
  }
}
