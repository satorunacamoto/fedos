/**
 * Secure Runtime Alpha 7721–7800 — durable, file-backed
 * `FedosArchiveSuppressionInboundDedupPersistence`. Mirrors
 * `AppendOnlyFedosPayloadRetentionPersistence`'s own backend exactly —
 * independent log file, NDJSON, insert-only, fail-closed on corruption,
 * full `replayLog()` on every call (restart-safe with zero hydration
 * code, per Phase A reconciliation report §7's own established
 * precedent).
 */

import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosPersistedArchiveSuppressionInboundImportRecordsAreEqual,
  type FedosArchiveSuppressionInboundDedupPersistence,
  type FedosArchiveSuppressionInboundImportWriteResult,
  type FedosPersistedArchiveSuppressionInboundImportRecordV1,
} from "./fedos_archive_suppression_inbound_dedup_persistence.js";

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

function replayLog(filePath: string): FedosPersistedArchiveSuppressionInboundImportRecordV1[] {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosPersistedArchiveSuppressionInboundImportRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedArchiveSuppressionInboundImportRecordV1;
    const existing = byId.get(parsed.relayEventId);
    if (existing === undefined) {
      byId.set(parsed.relayEventId, parsed);
    } else if (!fedosPersistedArchiveSuppressionInboundImportRecordsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosArchiveSuppressionInboundDedupPersistence: conflicting duplicate records for relayEventId "${String(parsed.relayEventId)}" found in log file.`,
      );
    }
  }
  return [...byId.values()];
}

export class AppendOnlyFedosArchiveSuppressionInboundDedupPersistence implements FedosArchiveSuppressionInboundDedupPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putImport(record: FedosPersistedArchiveSuppressionInboundImportRecordV1): FedosArchiveSuppressionInboundImportWriteResult {
    const existing = replayLog(this.#filePath).find((r) => r.relayEventId === record.relayEventId) ?? null;
    if (existing !== null) {
      return fedosPersistedArchiveSuppressionInboundImportRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getByRelayEventId(relayEventId: string): FedosPersistedArchiveSuppressionInboundImportRecordV1 | null {
    return replayLog(this.#filePath).find((r) => r.relayEventId === relayEventId) ?? null;
  }
}
