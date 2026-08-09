/**
 * Secure Runtime Alpha 753 ("Conversation Repository / Index Decision")
 * / Alpha 757 ("Read API") — Stages 13/17 of the Alpha 741–760
 * Canonical Conversation Identity and Record Foundation Arc.
 *
 * Alpha 753 compares:
 *   A. a full, separate in-memory repository/index (mirroring
 *      `FedosBoardService`'s own Source/Board/Thread index rebuild at
 *      hydration time) — REJECTED. `FedosBoardService` exists because
 *      `FedosBoardPost` has real cross-post integrity to maintain
 *      (thread/reply graphs, missing-parent detection) that is
 *      expensive to recompute per read. A Conversation record has no
 *      such graph: `FedosConversationId` is DETERMINISTIC from
 *      `(boardId, threadId)` (Alpha 743) and every V1 record already
 *      satisfies `rootPostId === rootThreadId` (Alpha 747/748) by
 *      construction — there is nothing a second in-memory index would
 *      compute that a direct persistence lookup does not already give
 *      for free.
 *   B. read straight through to `FedosConversationPersistence`, with a
 *      thin lookup helper for the one query the port does not expose
 *      directly (`listBoardConversations`) — ADOPTED. Matches
 *      `AppendOnlyFedosBoardPersistence`'s own "no side index yet"
 *      precedent (Alpha 355) exactly, extended here to the read layer
 *      too, not merely the storage layer.
 *
 * `FedosConversationReader` (Alpha 757) is this Arc's read-only facade
 * — the ONLY thing `FedosBoardRuntime` (Alpha 754) holds a reference to
 * for Conversation reads; `FedosConversationPersistence` itself is
 * NEVER returned to a caller (Alpha 757's own explicit requirement),
 * mirroring `FedosBoardReader`'s own identical role for
 * `FedosBoardPersistence` (`../board/repository/fedos_board_reader.ts`).
 *
 * `conversationForThread` needs no separate index (Alpha 747's own
 * finding): `toFedosConversationId(boardId, threadId)` alone resolves
 * the same record `findConversation` would, deterministically.
 *
 * HARD GUARDRAILS:
 *   - Every method is a pure read — no write method, no mutation of any
 *     kind.
 *   - No membership/private/capability method of any kind (Alpha 757's
 *     own explicit prohibition).
 *   - Never returns the injected `FedosConversationPersistence` itself.
 *   - Deserializes every record via `deserializeFedosConversationRecord`
 *     (Alpha 750, unmodified) — a corrupt persisted record is silently
 *     excluded from a `list*` result rather than thrown, matching this
 *     read layer's own "read is never where corruption is discovered
 *     for the first time" role (Alpha 756 owns the fail-closed
 *     corruption check, at restart, before any Runtime read ever runs).
 */

import type { FedosBoardId, FedosThreadId } from "../board/fedos_board_identifiers.js";
import { toFedosConversationId, type FedosConversationId } from "./fedos_conversation_id.js";
import type { FedosConversationRecord } from "./fedos_conversation_record.js";
import { deserializeFedosConversationRecord } from "./persistence/fedos_conversation_record_codec.js";
import type { FedosConversationPersistence } from "./persistence/fedos_conversation_persistence.js";

export class FedosConversationReader {
  readonly #persistence: FedosConversationPersistence;

  constructor(persistence: FedosConversationPersistence) {
    this.#persistence = persistence;
  }

  findConversation(id: FedosConversationId): FedosConversationRecord | null {
    const record = this.#persistence.getConversation(id);
    if (record === null) return null;
    return deserializeFedosConversationRecord(record);
  }

  conversationForThread(boardId: FedosBoardId, threadId: FedosThreadId): FedosConversationRecord | null {
    return this.findConversation(toFedosConversationId(boardId, threadId));
  }

  listBoardConversations(boardId: FedosBoardId): readonly FedosConversationRecord[] {
    const results: FedosConversationRecord[] = [];
    for (const persisted of this.#persistence.listConversations()) {
      if (persisted.boardId !== boardId) continue;
      const record = deserializeFedosConversationRecord(persisted);
      if (record !== null) results.push(record);
    }
    return results;
  }
}
