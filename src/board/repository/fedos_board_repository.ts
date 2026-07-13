/**
 * Secure Runtime Alpha 302 ("Board Repository Contract") — Stage 2 of
 * the Alpha 301–310 Canonical Board Repository, Index & Feed Foundation
 * Arc.
 *
 * The smallest protocol-independent container contract for
 * `FedosBoardPost` (`../fedos_board_post.js`, Alpha 255) values. Every
 * implementation of this contract (`InMemoryFedosBoardRepository`,
 * Alpha 303, and any future persistent implementation, Alpha 310 §5)
 * must satisfy it.
 *
 * HARD GUARDRAILS:
 *   - Synchronous — no method returns a `Promise`.
 *   - No protocol-specific input or output of any kind.
 *   - No Storage, Runtime, Desktop, Network, or `p2p` dependency.
 *   - No mutable internal collection exposure — `listPosts` returns
 *     `readonly FedosBoardPost[]`.
 *   - No update/edit method of any kind — a repository never edits a
 *     `FedosBoardPost` in place.
 *   - `removePost` is deliberately EXCLUDED from this first contract —
 *     see this Stage's own design doc §3 for why (deletion/moderation
 *     is a separate, not-yet-designed responsibility, matching
 *     `FedosBoardModerationRecord`'s own established separation, Alpha
 *     258).
 */

import type { FedosBoardPostId } from "../fedos_board_identifiers.js";
import type { FedosBoardPost } from "../fedos_board_post.js";

/**
 * The result of one `register` call. No boolean hides the reason:
 *   - `"inserted"`: a genuinely new `id` was accepted.
 *   - `"already-present"`: the same `id` was registered again with a
 *     STRUCTURALLY IDENTICAL post — idempotent, no mutation occurred.
 *   - `"conflict"`: the same `id` was registered again with a
 *     DIFFERENT post — the original is preserved, the new one is
 *     rejected, fail closed.
 */
export type FedosBoardRepositoryWriteResult = "inserted" | "already-present" | "conflict";

/** A protocol-independent, synchronous, in-memory-shaped container contract for `FedosBoardPost`. */
export interface FedosBoardRepository {
  register(post: FedosBoardPost): FedosBoardRepositoryWriteResult;
  findPost(id: FedosBoardPostId): FedosBoardPost | null;
  listPosts(): readonly FedosBoardPost[];
}

/**
 * Field-by-field structural equality over every `FedosBoardPost` field,
 * including the `author`/`source` sub-objects. This is the rule
 * `"already-present"` (§ above) depends on — part of the CONTRACT's own
 * semantics, not one implementation's private detail. A plain, explicit
 * comparison, not a generic deep-equality utility.
 */
export function fedosBoardPostsAreStructurallyEqual(a: FedosBoardPost, b: FedosBoardPost): boolean {
  return (
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
