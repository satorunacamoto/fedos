/**
 * Secure Runtime Alpha 315 ("Board Persistence Port") — Stage 5 of the
 * Alpha 311–320 Canonical Board Persistence Boundary Arc.
 *
 * The backend-neutral port every persistence backend implements —
 * `InMemoryFedosBoardPersistence` (`./in_memory_fedos_board_persistence.js`,
 * Alpha 316, this Arc's only implementation) and any future durable
 * backend (Alpha 320 §5's own recommended next Arc).
 *
 * HARD GUARDRAILS:
 *   - Synchronous — this Stage's own contract; a future async backend
 *     needs a SEPARATE port, never a silent mutation of this one (see
 *     this Stage's own design doc §6).
 *   - No database-specific vocabulary, no SQL, no KV keys, no
 *     filesystem paths, no Secure Runtime handles, no `p2p` types, no
 *     protocol adapters, no network.
 *   - No `delete` method — deliberately excluded this Arc (design doc
 *     §4).
 */

import type { FedosPersistedBoardPostRecordV1 } from "./fedos_persisted_board_post_v1.js";

/**
 * The result of one `putPost` call. Mirrors
 * `FedosBoardRepositoryWriteResult` (Alpha 302) plus one
 * persistence-specific outcome:
 *   - `"inserted"`: a genuinely new `id` was accepted.
 *   - `"already-present"`: the same `id` was written again with a
 *     STRUCTURALLY IDENTICAL record — idempotent, no mutation occurred.
 *   - `"conflict"`: the same `id` was written again with a DIFFERENT
 *     record — the original is preserved, fail closed.
 *   - `"failed"`: the backend itself could not complete the write for a
 *     reason unrelated to record content (e.g. a future durable
 *     backend's own I/O failure) — never conflated with `"conflict"`.
 */
export type FedosBoardPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosBoardPersistence {
  putPost(record: FedosPersistedBoardPostRecordV1): FedosBoardPersistenceWriteResult;
  getPost(id: string): FedosPersistedBoardPostRecordV1 | null;
  listPosts(): readonly FedosPersistedBoardPostRecordV1[];
}

/**
 * Field-by-field structural equality over every `FedosPersistedBoardPostRecordV1`
 * field, including the `author`/`source` sub-objects. This is the rule
 * `"already-present"` (§ above) depends on — part of the PORT's own
 * semantics, not one backend's private detail, mirroring
 * `fedosBoardPostsAreStructurallyEqual`'s own identical role for
 * `FedosBoardRepository` (`../fedos_board_repository.js`, Alpha 302 §5).
 * Deliberately NOT a `JSON.stringify` comparison: this file makes no
 * claim about key-enumeration order anywhere, so this comparison stays
 * correct regardless of how a future backend happens to construct a
 * record.
 */
export function fedosPersistedBoardPostRecordsAreEqual(
  a: FedosPersistedBoardPostRecordV1,
  b: FedosPersistedBoardPostRecordV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.id === b.id &&
    a.boardId === b.boardId &&
    a.threadId === b.threadId &&
    a.replyTo === b.replyTo &&
    a.body === b.body &&
    a.createdAt === b.createdAt &&
    a.author.identityId === b.author.identityId &&
    a.author.protocol === b.author.protocol &&
    a.author.publicIdentifier === b.author.publicIdentifier &&
    a.source.protocol === b.source.protocol &&
    a.source.reference === b.source.reference
  );
}
