/**
 * Secure Runtime Alpha 756 ("Hydration and Migration") — Stage 16 of the
 * Alpha 741–760 Canonical Conversation Identity and Record Foundation
 * Arc.
 *
 * Unlike `hydrateFedosBoardService` (`../board/persistence/fedos_board_hydration.ts`,
 * Alpha 318), this function builds NO in-memory service/index — Alpha
 * 753 already decided no such index is needed for Conversation reads.
 * Its only job is the ONE thing Alpha 756 requires that reading alone
 * would not catch: verifying every persisted Conversation record's own
 * root/thread reference against the ALREADY-hydrated Board state,
 * failing closed on any mismatch or corrupt record — called once, at
 * `startFedosDesktopRuntime()` startup (Alpha 758), strictly AFTER
 * `host.start()` has already hydrated the Board (so `boardReader` is
 * real and complete), and strictly BEFORE any `FedosBoardRuntime`
 * Conversation read is ever reachable.
 *
 * Alpha 756's own required decision — how pre-Conversation historical
 * Board data is handled — is **Option C: legacy threads remain readable
 * but lack Application mutation support.** A Board thread with NO
 * Conversation record is not an error condition this function detects
 * or reports at all: `FedosConversationReader.conversationForThread()`
 * (Alpha 753/757) simply returns `null` for it, and
 * `FedosBoardRuntime.replyToPublicThread()` (Alpha 755) already
 * tolerates that `null` (a `"not-found"` association outcome,
 * unchanged Board-level reply behavior) — Option A (fail startup for
 * any legacy gap) was rejected as breaking this Arc's own Rule 10
 * ("Existing public Board behavior must remain compatible") for the
 * ordinary, expected case of a Board log that predates this Arc; Option
 * B (auto-migrate a record into existence for every legacy thread) was
 * rejected as silently fabricating a policy/creation-time association
 * for data no real policy decision was ever made about (Alpha 756's own
 * "do not silently fabricate policy history" instruction); Option D (a
 * separate migration tool) is unnecessary complexity this Arc's own
 * scope does not need. What THIS function fails closed on is narrower
 * and stronger: a Conversation record that EXISTS but is corrupt, or
 * whose root reference does NOT match the hydrated Board state it
 * claims to describe — that is not a legacy gap, it is either storage
 * corruption or a genuine invariant violation, and per this Arc's own
 * Absolute Prohibitions (no silent repair) it must halt startup, not be
 * silently dropped.
 *
 * HARD GUARDRAILS:
 *   - No side effect of any kind — a pure read-and-verify pass. No
 *     write to `conversationPersistence`, no repair, no compaction.
 *   - Fails closed: any corrupt record OR any root-mismatch halts
 *     hydration entirely (mirrors `hydrateFedosBoardService`'s own "no
 *     partial service returned on corruption" rule) — the caller
 *     (`startFedosDesktopRuntime`) converts a non-`"hydrated"` outcome
 *     into a thrown `Error`, the same pattern `FedosDesktopHost.start()`
 *     already uses for a corrupt Board log.
 *   - No network, no Relay, no Ontology inference, no background task.
 */

import type { FedosBoardReader } from "../board/repository/fedos_board_reader.js";
import type { FedosConversationPersistence } from "./persistence/fedos_conversation_persistence.js";
import { deserializeFedosConversationRecord } from "./persistence/fedos_conversation_record_codec.js";

export type FedosConversationHydrationOutcome =
  | "hydrated"
  | "rejected-corrupt-record"
  | "rejected-root-mismatch";

export interface FedosConversationHydrationResult {
  readonly outcome: FedosConversationHydrationOutcome;
  readonly verifiedCount: number;
  readonly corruptRecordCount: number;
  readonly mismatchedCount: number;
}

/**
 * Verifies every persisted Conversation record against `boardReader`
 * (an ALREADY-hydrated `FedosBoardReader` — see this file's own
 * header). A record is valid only when its root post exists, belongs
 * to the same `boardId`, is genuinely a thread root (`replyTo === null`),
 * and its own `threadId` matches `record.rootThreadId`.
 */
export function hydrateFedosConversations(
  conversationPersistence: FedosConversationPersistence,
  boardReader: FedosBoardReader,
): FedosConversationHydrationResult {
  let corruptRecordCount = 0;
  let mismatchedCount = 0;
  let verifiedCount = 0;

  for (const persisted of conversationPersistence.listConversations()) {
    const record = deserializeFedosConversationRecord(persisted);
    if (record === null) {
      corruptRecordCount += 1;
      continue;
    }

    const rootPost = boardReader.findPost(record.rootPostId);
    const isConsistent =
      rootPost !== null &&
      rootPost.boardId === record.boardId &&
      rootPost.threadId === record.rootThreadId &&
      rootPost.replyTo === null;

    if (!isConsistent) {
      mismatchedCount += 1;
      continue;
    }
    verifiedCount += 1;
  }

  if (corruptRecordCount > 0) {
    return { outcome: "rejected-corrupt-record", verifiedCount: 0, corruptRecordCount, mismatchedCount: 0 };
  }
  if (mismatchedCount > 0) {
    return { outcome: "rejected-root-mismatch", verifiedCount: 0, corruptRecordCount: 0, mismatchedCount };
  }
  return { outcome: "hydrated", verifiedCount, corruptRecordCount: 0, mismatchedCount: 0 };
}
