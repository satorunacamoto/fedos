/**
 * Secure Runtime Alpha 316 ("In-Memory Board Persistence Backend") —
 * Stage 6 of the Alpha 311–320 Canonical Board Persistence Boundary
 * Arc.
 *
 * The first, and this Arc's only, concrete `FedosBoardPersistence`
 * (`./fedos_board_persistence.js`, Alpha 315). Follows the SAME
 * private-field `Map`-backed class convention
 * `InMemoryFedosBoardRepository`
 * (`../repository/in_memory_fedos_board_repository.js`, Alpha 303)
 * already established. NOT the same thing as that class — this file
 * stores PLAIN PERSISTED RECORDS (`FedosPersistedBoardPostRecordV1`,
 * Alpha 313), never a validated `FedosBoardPost` application object.
 * See this Stage's own design doc §3.
 *
 * HARD GUARDRAILS:
 *   - Deterministic, no constructor side effects.
 *   - Independent instances never share state — no module-level
 *     mutable state exists in this file.
 *   - `listPosts()` returns a NEW array every call.
 *   - No persistence to JSON, no filesystem, no background work, no
 *     indexes, no feed logic.
 */

import {
  fedosPersistedBoardPostRecordsAreEqual,
  type FedosBoardPersistence,
  type FedosBoardPersistenceWriteResult,
} from "./fedos_board_persistence.js";
import type { FedosPersistedBoardPostRecordV1 } from "./fedos_persisted_board_post_v1.js";

export class InMemoryFedosBoardPersistence implements FedosBoardPersistence {
  readonly #records = new Map<string, FedosPersistedBoardPostRecordV1>();

  putPost(record: FedosPersistedBoardPostRecordV1): FedosBoardPersistenceWriteResult {
    const existing = this.#records.get(record.id);
    if (existing === undefined) {
      this.#records.set(record.id, record);
      return "inserted";
    }
    if (fedosPersistedBoardPostRecordsAreEqual(existing, record)) {
      return "already-present";
    }
    return "conflict";
  }

  getPost(id: string): FedosPersistedBoardPostRecordV1 | null {
    return this.#records.get(id) ?? null;
  }

  listPosts(): readonly FedosPersistedBoardPostRecordV1[] {
    return [...this.#records.values()];
  }
}
