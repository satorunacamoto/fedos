/** Secure Runtime Alpha 1426 — append-only `FedosPrivateNostrImportRecordPersistence` backend. Mirrors every other append-only port's NDJSON, insert-only, fail-closed-on-conflict convention in this codebase. */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosPrivateNostrImportRecordsAreEqual,
  type FedosPrivateNostrImportRecord,
  type FedosPrivateNostrImportRecordPersistence,
  type FedosPrivateNostrImportRecordPersistenceWriteResult,
} from "./fedos_private_nostr_import_record.js";

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

function replayLog(filePath: string): FedosPrivateNostrImportRecord[] {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosPrivateNostrImportRecord>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPrivateNostrImportRecord;
    const existing = byId.get(parsed.nostrEventId);
    if (existing === undefined) {
      byId.set(parsed.nostrEventId, parsed);
    } else if (!fedosPrivateNostrImportRecordsAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosPrivateNostrImportRecordPersistence: conflicting duplicate records for id "${parsed.nostrEventId}" found in log file.`);
    }
  }
  return [...byId.values()];
}

export class AppendOnlyFedosPrivateNostrImportRecordPersistence implements FedosPrivateNostrImportRecordPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putImportFact(record: FedosPrivateNostrImportRecord): FedosPrivateNostrImportRecordPersistenceWriteResult {
    const existing = replayLog(this.#filePath).find((r) => r.nostrEventId === record.nostrEventId) ?? null;
    if (existing !== null) {
      return fedosPrivateNostrImportRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getImport(nostrEventId: string): FedosPrivateNostrImportRecord | null {
    return replayLog(this.#filePath).find((r) => r.nostrEventId === nostrEventId) ?? null;
  }
}
