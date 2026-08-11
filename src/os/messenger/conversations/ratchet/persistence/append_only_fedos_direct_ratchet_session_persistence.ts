/**
 * Secure Runtime Alpha 5401-5480 — Phase G: the append-only, durable
 * `FedosDirectRatchetSessionPersistence` backend. NDJSON, one
 * `FedosDirectRatchetSessionRecordV1` per line, insert-only, event-sourced
 * by `revision` (see the port's own header for the exact contract).
 * Mirrors `AppendOnlyFedosConversationPersistence`'s own established
 * fail-closed replay discipline: a malformed/unrecognized line THROWS on
 * replay, never silently skipped or repaired. A line whose `revision`
 * repeats an existing one with different content, or that is not
 * exactly the next expected revision for its `sessionId`, or whose
 * `binding` disagrees with an earlier revision of the same
 * `sessionId`, is a conflicting/out-of-order record IN THE LOG ITSELF —
 * replay THROWS rather than silently picking a winner or reordering.
 *
 * HARD GUARDRAILS: no secret-bearing field is ever written (enforced by
 * `FedosDirectRatchetSessionRecordV1`'s own closed field set); no
 * delete/compaction/rewrite method of any kind.
 */
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  decodeFedosDirectRatchetSessionRecordV1,
  encodeFedosDirectRatchetSessionRecordV1,
  fedosDirectRatchetSessionRecordsEqual,
  type FedosDirectRatchetSessionRecordV1,
} from "../fedos_direct_ratchet_session_record.js";
import type { FedosDirectRatchetSessionId } from "../fedos_direct_ratchet_session_id.js";
import type {
  FedosDirectRatchetSessionPersistence,
  FedosDirectRatchetSessionPersistenceWriteResult,
} from "./fedos_direct_ratchet_session_persistence.js";

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

/** Replays every revision of every session, throwing on any malformed line, revision gap, revision conflict, or binding disagreement across revisions of the same session. Returns, per `sessionId`, ONLY the highest-revision record. */
function replayLog(filePath: string): Map<string, FedosDirectRatchetSessionRecordV1> {
  const contents = readLogFile(filePath);
  const byId = new Map<string, Map<number, FedosDirectRatchetSessionRecordV1>>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = decodeFedosDirectRatchetSessionRecordV1(line);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosDirectRatchetSessionPersistence: malformed line found in log file.");
    }
    const sessionId = parsed.binding.sessionId;
    let byRevision = byId.get(sessionId);
    if (!byRevision) {
      if (parsed.revision !== 0) {
        throw new Error(
          `AppendOnlyFedosDirectRatchetSessionPersistence: first revision for sessionId "${sessionId}" is not 0.`,
        );
      }
      byRevision = new Map();
      byId.set(sessionId, byRevision);
    }
    const existingAtRevision = byRevision.get(parsed.revision);
    if (existingAtRevision !== undefined) {
      if (!fedosDirectRatchetSessionRecordsEqual(existingAtRevision, parsed)) {
        throw new Error(
          `AppendOnlyFedosDirectRatchetSessionPersistence: conflicting duplicate records for sessionId "${sessionId}" revision ${parsed.revision} found in log file.`,
        );
      }
      continue;
    }
    const highest = Math.max(-1, ...byRevision.keys());
    if (parsed.revision !== highest + 1) {
      throw new Error(
        `AppendOnlyFedosDirectRatchetSessionPersistence: out-of-order revision for sessionId "${sessionId}" found in log file (expected ${highest + 1}, got ${parsed.revision}).`,
      );
    }
    const anyExisting = byRevision.get(highest);
    if (anyExisting && JSON.stringify(anyExisting.binding) !== JSON.stringify(parsed.binding)) {
      throw new Error(
        `AppendOnlyFedosDirectRatchetSessionPersistence: binding disagreement across revisions for sessionId "${sessionId}" found in log file.`,
      );
    }
    byRevision.set(parsed.revision, parsed);
  }
  const latest = new Map<string, FedosDirectRatchetSessionRecordV1>();
  for (const [sessionId, byRevision] of byId) {
    const highest = Math.max(...byRevision.keys());
    const record = byRevision.get(highest);
    if (record) latest.set(sessionId, record);
  }
  return latest;
}

export class AppendOnlyFedosDirectRatchetSessionPersistence implements FedosDirectRatchetSessionPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putSession(record: FedosDirectRatchetSessionRecordV1): FedosDirectRatchetSessionPersistenceWriteResult {
    const latest = replayLog(this.#filePath);
    const existing = latest.get(record.binding.sessionId);
    const expectedRevision = existing ? existing.revision + 1 : 0;
    if (record.revision !== expectedRevision) {
      if (existing && record.revision === existing.revision) {
        return fedosDirectRatchetSessionRecordsEqual(existing, record) ? "already-present" : "conflict";
      }
      return "conflict";
    }
    if (existing && JSON.stringify(existing.binding) !== JSON.stringify(record.binding)) return "conflict";
    try {
      appendFileSync(this.#filePath, encodeFedosDirectRatchetSessionRecordV1(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getSession(sessionId: FedosDirectRatchetSessionId): FedosDirectRatchetSessionRecordV1 | null {
    return replayLog(this.#filePath).get(sessionId) ?? null;
  }

  listSessions(): readonly FedosDirectRatchetSessionRecordV1[] {
    return [...replayLog(this.#filePath).values()];
  }
}
