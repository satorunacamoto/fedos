/**
 * Secure Runtime Alpha 307 ("Board Repository Application Service") —
 * Stage 7 of the Alpha 301–310 Canonical Board Repository, Index &
 * Feed Foundation Arc.
 *
 * The ONE write boundary coordinating `FedosBoardRepository` (Alpha
 * 302/303), `FedosBoardSourceIndex` (Alpha 304), and `FedosBoardIndex`
 * (Alpha 305), applying the thread integrity rules named in Alpha 306.
 * No caller ever needs to call the three underlying components itself.
 *
 * HARD GUARDRAILS:
 *   - No exceptions for normal rejection — every rejection is a
 *     RETURNED token; nothing here throws.
 *   - No partial writes: all checks are pure reads, run BEFORE the
 *     first mutating call (see this Stage's own design doc §3–§4 for
 *     why this guarantees atomicity with no transaction framework).
 *   - No Storage, Runtime, Desktop, protocol-adapter, or `p2p` import
 *     of any kind.
 */

import type { FedosBoardId, FedosBoardPostId, FedosThreadId } from "../fedos_board_identifiers.js";
import type { FedosBoardPost } from "../fedos_board_post.js";
import { InMemoryFedosBoardRepository } from "./in_memory_fedos_board_repository.js";
import type { FedosBoardRepository } from "./fedos_board_repository.js";
import { FedosBoardSourceIndex } from "./fedos_board_source_index.js";
import { FedosBoardIndex } from "./fedos_board_index.js";

export type FedosBoardRegistrationResult =
  | "inserted"
  | "already-present"
  | "post-id-conflict"
  | "source-conflict"
  | "missing-parent"
  | "invalid-thread"
  | "cross-board-reply";

export class FedosBoardService {
  readonly #repository: FedosBoardRepository;
  readonly #sourceIndex: FedosBoardSourceIndex;
  readonly #boardIndex: FedosBoardIndex;

  constructor(
    repository: FedosBoardRepository = new InMemoryFedosBoardRepository(),
    sourceIndex: FedosBoardSourceIndex = new FedosBoardSourceIndex(),
    boardIndex: FedosBoardIndex = new FedosBoardIndex(),
  ) {
    this.#repository = repository;
    this.#sourceIndex = sourceIndex;
    this.#boardIndex = boardIndex;
  }

  registerPost(post: FedosBoardPost): FedosBoardRegistrationResult {
    // 1. Thread integrity (Alpha 306) -- pure reads only, no mutation.
    if (post.replyTo === null) {
      // FedosThreadId and FedosBoardPostId are deliberately distinct
      // branded types (Alpha 252: "no free interchange") -- comparing
      // their underlying opaque string VALUES for a root's own
      // convention (threadId === id, Alpha 256 Section 1) requires an
      // explicit, intentional unbranding cast, never an implicit one.
      if ((post.threadId as string) !== (post.id as string)) return "invalid-thread";
    } else {
      const parent = this.#repository.findPost(post.replyTo);
      if (parent === null) return "missing-parent";
      if (parent.boardId !== post.boardId) return "cross-board-reply";
      if (parent.threadId !== post.threadId) return "invalid-thread";
    }

    // 2. Source provenance pre-check -- pure read only, before any write.
    const existingSourcePostId = this.#sourceIndex.findBySource(post.source);
    if (existingSourcePostId !== null && existingSourcePostId !== post.id) {
      return "source-conflict";
    }

    // 3. Repository write -- the first mutating call.
    const repositoryResult = this.#repository.register(post);
    if (repositoryResult === "conflict") return "post-id-conflict";

    // 4. Source Index + Board Index writes -- guaranteed consistent by
    // construction once step 3 succeeded (see design doc §4).
    this.#sourceIndex.register(post);
    this.#boardIndex.register(post);

    return repositoryResult;
  }

  findPost(id: FedosBoardPostId): FedosBoardPost | null {
    return this.#repository.findPost(id);
  }

  listBoardPosts(boardId: FedosBoardId): readonly FedosBoardPost[] {
    return this.#resolvePosts(this.#boardIndex.listBoardPostIds(boardId));
  }

  listThreadPosts(boardId: FedosBoardId, threadId: FedosThreadId): readonly FedosBoardPost[] {
    return this.#resolvePosts(this.#boardIndex.listThreadPostIds(boardId, threadId));
  }

  #resolvePosts(ids: readonly FedosBoardPostId[]): readonly FedosBoardPost[] {
    const posts: FedosBoardPost[] = [];
    for (const id of ids) {
      const post = this.#repository.findPost(id);
      if (post !== null) posts.push(post);
    }
    return posts;
  }
}
