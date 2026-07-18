/**
 * Secure Runtime Alpha 1342 — append-only `FedosGroupMessagePersistence`
 * backend. Mirrors `AppendOnlyFedosConversationActivationPersistence`'s own
 * NDJSON, insert-only, fail-closed-on-conflict convention (Alpha 1121).
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosGroupMessageRecordKey,
  fedosGroupMessageRecordsAreEqual,
  resolveCurrentGroupMessageRecord,
  type FedosGroupMessagePersistence,
  type FedosGroupMessagePersistenceWriteResult,
  type FedosGroupMessageRecord,
} from "./fedos_group_message.js";

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

function replayLog(filePath: string): FedosGroupMessageRecord[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosGroupMessageRecord>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosGroupMessageRecord;
    const key = fedosGroupMessageRecordKey(parsed.id, parsed.fanoutState);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosGroupMessageRecordsAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosGroupMessagePersistence: conflicting duplicate records for key "${key}" found in log file.`);
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosGroupMessagePersistence implements FedosGroupMessagePersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putMessageFact(record: FedosGroupMessageRecord): FedosGroupMessagePersistenceWriteResult {
    const key = fedosGroupMessageRecordKey(record.id, record.fanoutState);
    const existing = replayLog(this.#filePath).find((r) => fedosGroupMessageRecordKey(r.id, r.fanoutState) === key) ?? null;
    if (existing !== null) {
      return fedosGroupMessageRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getMessage(id: string): FedosGroupMessageRecord | null {
    return resolveCurrentGroupMessageRecord(replayLog(this.#filePath).filter((r) => r.id === id));
  }

  listMessagesForGroup(groupConversationId: string): readonly FedosGroupMessageRecord[] {
    const byId = new Map<string, FedosGroupMessageRecord[]>();
    for (const record of replayLog(this.#filePath)) {
      if (record.groupConversationId !== groupConversationId) continue;
      const list = byId.get(record.id) ?? [];
      list.push(record);
      byId.set(record.id, list);
    }
    const result: FedosGroupMessageRecord[] = [];
    for (const facts of byId.values()) {
      const current = resolveCurrentGroupMessageRecord(facts);
      if (current !== null) result.push(current);
    }
    return result.sort((a, b) => (a.createdAt !== b.createdAt ? a.createdAt - b.createdAt : a.id.localeCompare(b.id)));
  }
}
