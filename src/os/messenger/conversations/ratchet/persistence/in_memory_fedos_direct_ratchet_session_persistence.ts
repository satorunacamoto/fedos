/**
 * Secure Runtime Alpha 5401-5480 — Phase G: the in-memory
 * `FedosDirectRatchetSessionPersistence` backend. Event-sourced by
 * revision (see the port's own header) -- keeps every revision ever
 * written (never overwrites one), and serves `getSession`/`listSessions`
 * from the highest revision per `sessionId`.
 */
import { fedosDirectRatchetSessionRecordsEqual, type FedosDirectRatchetSessionRecordV1 } from "../../../../../conversation/ratchet/fedos_direct_ratchet_session_record.js";
import type { FedosDirectRatchetSessionId } from "../../../../../conversation/ratchet/fedos_direct_ratchet_session_id.js";
import type {
  FedosDirectRatchetSessionPersistence,
  FedosDirectRatchetSessionPersistenceWriteResult,
} from "../../../../../conversation/ratchet/persistence/fedos_direct_ratchet_session_persistence.js";

export class InMemoryFedosDirectRatchetSessionPersistence implements FedosDirectRatchetSessionPersistence {
  /** sessionId -> revision -> record. */
  readonly #revisions = new Map<string, Map<number, FedosDirectRatchetSessionRecordV1>>();

  putSession(record: FedosDirectRatchetSessionRecordV1): FedosDirectRatchetSessionPersistenceWriteResult {
    const sessionId = record.binding.sessionId;
    let byRevision = this.#revisions.get(sessionId);
    if (!byRevision) {
      if (record.revision !== 0) return "conflict";
      byRevision = new Map();
      this.#revisions.set(sessionId, byRevision);
    }
    const existingAtRevision = byRevision.get(record.revision);
    if (existingAtRevision !== undefined) {
      return fedosDirectRatchetSessionRecordsEqual(existingAtRevision, record) ? "already-present" : "conflict";
    }
    const highest = Math.max(-1, ...byRevision.keys());
    if (record.revision !== highest + 1) return "conflict";
    const anyExisting = byRevision.get(highest);
    if (anyExisting && JSON.stringify(anyExisting.binding) !== JSON.stringify(record.binding)) return "conflict";
    byRevision.set(record.revision, record);
    return "inserted";
  }

  getSession(sessionId: FedosDirectRatchetSessionId): FedosDirectRatchetSessionRecordV1 | null {
    const byRevision = this.#revisions.get(sessionId);
    if (!byRevision || byRevision.size === 0) return null;
    const highest = Math.max(...byRevision.keys());
    return byRevision.get(highest) ?? null;
  }

  listSessions(): readonly FedosDirectRatchetSessionRecordV1[] {
    const result: FedosDirectRatchetSessionRecordV1[] = [];
    for (const sessionId of this.#revisions.keys()) {
      const record = this.getSession(sessionId as FedosDirectRatchetSessionId);
      if (record) result.push(record);
    }
    return result;
  }
}
