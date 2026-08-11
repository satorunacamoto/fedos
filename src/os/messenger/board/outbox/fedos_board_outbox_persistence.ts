/**
 * Secure Runtime Alpha 417 ("Outbox Persistence Port and In-Memory
 * Backend") — Stage 7 of the Alpha 411–420 Canonical Board Durable
 * Outbox Foundation Arc.
 *
 * The backend-neutral port every Outbox persistence backend implements
 * — `InMemoryFedosBoardOutboxPersistence`
 * (`./in_memory_fedos_board_outbox_persistence.js`, this Arc) and
 * `AppendOnlyFedosBoardOutboxPersistence`
 * (`./append_only_fedos_board_outbox_persistence.js`, Alpha 418).
 * Mirrors `FedosBoardPersistence`'s own shape and semantics
 * (`../persistence/fedos_board_persistence.ts`, Alpha 315) — a
 * DELIBERATELY SEPARATE port, not folded into it, since an Outbox
 * intent is not a Board post (see
 * `docs/secure_runtime_alpha_412_outbox_responsibility_decision.md`).
 *
 * HARD GUARDRAILS:
 *   - Synchronous — the same contract `FedosBoardPersistence` itself
 *     adopted.
 *   - No `delete`, no `dequeue`, no acknowledgment, no retry method, no
 *     protocol publisher method, no database vocabulary, no network, no
 *     Board Repository mutation of any kind.
 */

import type { FedosPersistedBoardOutboxRecordV1 } from "./fedos_board_outbox_codec.js";

/**
 * The result of one `putIntent` call — mirrors
 * `FedosBoardPersistenceWriteResult` (Alpha 315) exactly:
 *   - `"inserted"`: a genuinely new `id` was accepted.
 *   - `"already-present"`: the same `id` was written again with a
 *     STRUCTURALLY IDENTICAL record — idempotent, no mutation occurred.
 *   - `"conflict"`: the same `id` was written again with a DIFFERENT
 *     record — the original is preserved, fail closed.
 *   - `"failed"`: the backend itself could not complete the write for a
 *     reason unrelated to record content.
 */
export type FedosBoardOutboxPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosBoardOutboxPersistence {
  putIntent(record: FedosPersistedBoardOutboxRecordV1): FedosBoardOutboxPersistenceWriteResult;
  getIntent(id: string): FedosPersistedBoardOutboxRecordV1 | null;
  listIntents(): readonly FedosPersistedBoardOutboxRecordV1[];
}

/**
 * Field-by-field structural equality over every
 * `FedosPersistedBoardOutboxRecordV1` field, including the nested
 * `target` sub-object — the rule `"already-present"` (§ above) depends
 * on, mirroring `fedosPersistedBoardPostRecordsAreEqual`'s own identical
 * role (`../persistence/fedos_board_persistence.ts`, Alpha 315).
 * Deliberately NOT a `JSON.stringify` comparison — see that function's
 * own header for why.
 */
export function fedosPersistedBoardOutboxRecordsAreEqual(
  a: FedosPersistedBoardOutboxRecordV1,
  b: FedosPersistedBoardOutboxRecordV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.id === b.id &&
    a.postId === b.postId &&
    a.createdAt === b.createdAt &&
    a.target.protocol === b.target.protocol &&
    a.target.destination === b.target.destination
  );
}
