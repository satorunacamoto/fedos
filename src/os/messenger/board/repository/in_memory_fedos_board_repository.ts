/**
 * Secure Runtime Alpha 303 ("In-Memory Board Repository") — Stage 3 of
 * the Alpha 301–310 Canonical Board Repository, Index & Feed Foundation
 * Arc.
 *
 * The first, and this Arc's only, concrete `FedosBoardRepository`
 * (`./fedos_board_repository.js`, Alpha 302). Follows the private-field
 * `Map`-backed class convention already used twice in this repository
 * (`InMemorySpaceDirectory`, `src/community/directory.ts`, Stage 11;
 * `InMemoryEventCache`, `src/cache/event_cache.ts`, Stage 6).
 *
 * Stores every registered post BY REFERENCE, never re-copies or
 * re-freezes: `validateFedosBoardPost` (`../fedos_board_post_validator.js`,
 * Alpha 257) already deep-copies and `Object.freeze`s every
 * `FedosBoardPost` (and its `author`/`source` sub-objects) it produces
 * — the ONLY way a `FedosBoardPost` value can exist. See this Stage's
 * own design doc §4.
 *
 * HARD GUARDRAILS:
 *   - Deterministic, synchronous, no constructor side effects.
 *   - Independent instances never share state — no module-level
 *     mutable state exists in this file.
 *   - `listPosts()` returns a NEW array every call — no live reference
 *     to the internal `Map` is ever exposed.
 *   - No persistence, no background work, no implicit source
 *     deduplication (that is `FedosBoardSourceIndex`'s own job, Alpha
 *     304), no clone policy beyond "store by reference" (§4 above).
 */

import type { FedosBoardPostId } from "../fedos_board_identifiers.js";
import type { FedosBoardPost } from "../fedos_board_post.js";
import {
  fedosBoardPostsAreStructurallyEqual,
  type FedosBoardRepository,
  type FedosBoardRepositoryWriteResult,
} from "./fedos_board_repository.js";

export class InMemoryFedosBoardRepository implements FedosBoardRepository {
  readonly #posts = new Map<FedosBoardPostId, FedosBoardPost>();

  register(post: FedosBoardPost): FedosBoardRepositoryWriteResult {
    const existing = this.#posts.get(post.id);
    if (existing === undefined) {
      this.#posts.set(post.id, post);
      return "inserted";
    }
    if (fedosBoardPostsAreStructurallyEqual(existing, post)) {
      return "already-present";
    }
    return "conflict";
  }

  findPost(id: FedosBoardPostId): FedosBoardPost | null {
    return this.#posts.get(id) ?? null;
  }

  listPosts(): readonly FedosBoardPost[] {
    return [...this.#posts.values()];
  }
}
