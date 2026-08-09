/**
 * Secure Runtime Alpha 5401-5480 — Phase G: the dedicated Direct Ratchet
 * session-metadata persistence port. Mirrors `FedosConversationPersistence`'s
 * own shape (`../../persistence/fedos_conversation_persistence.ts`, Alpha
 * 749) exactly -- a DEDICATED port, never folded into it (a ratchet
 * session record and a Conversation record are different durable facts
 * with different lifecycles). Carries PUBLIC metadata only -- see
 * `../fedos_direct_ratchet_session_record.ts`'s own header.
 *
 * HARD GUARDRAILS:
 *   - No `delete` method -- this Arc's own Absolute Prohibitions forbid
 *     deletion/compaction entirely.
 *   - Synchronous, matching every other filesystem-backed port in this
 *     codebase.
 */
import type { FedosDirectRatchetSessionId } from "../fedos_direct_ratchet_session_id.js";
import type { FedosDirectRatchetSessionRecordV1 } from "../fedos_direct_ratchet_session_record.js";

export type FedosDirectRatchetSessionPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosDirectRatchetSessionPersistence {
  /**
   * Event-sourced append: `record.revision` MUST be exactly `0` for a
   * session id never seen before, or exactly `(current highest revision
   * for record.binding.sessionId) + 1` for one already known --
   * `"conflict"` for a revision that repeats an existing one with
   * different content, skips ahead, goes backward, or disagrees with an
   * earlier revision's own `binding`. An EXACT repeat of an existing
   * revision's content is idempotent `"already-present"`. This is the
   * ONLY way this port's records ever change -- there is no update/
   * delete method of any kind.
   */
  putSession(record: FedosDirectRatchetSessionRecordV1): FedosDirectRatchetSessionPersistenceWriteResult;
  /** Returns the HIGHEST-revision record for `sessionId`, or `null` if none exists. */
  getSession(sessionId: FedosDirectRatchetSessionId): FedosDirectRatchetSessionRecordV1 | null;
  /** One (highest-revision) record per known `sessionId`. */
  listSessions(): readonly FedosDirectRatchetSessionRecordV1[];
}
