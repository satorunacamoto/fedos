/**
 * Secure Runtime Alpha 307 ("Board Repository Application Service") —
 * Stage 7 of the Alpha 301–310 Canonical Board Repository, Index &
 * Feed Foundation Arc. Alpha 395 ("Implement Host Write API") — Stage
 * 5 of the Alpha 391–400 Desktop Host Durable Write Coordination Arc —
 * adds `previewRegistration()` below, unmodified `registerPost()`
 * behavior otherwise. Alpha 403 ("Read-Only Board Access Model") —
 * Stage 3 of the Alpha 401–410 Desktop Host Canonical Write Boundary
 * Closure Arc — adds `implements FedosBoardReader`
 * (`./fedos_board_reader.js`) to this class's own declaration ONLY —
 * a purely additive, compile-time-checked confirmation that this
 * class's existing `findPost`/`listBoardPosts`/`listThreadPosts`
 * ALREADY satisfy that contract verbatim; zero behavior change, zero
 * new method, zero new field.
 *
 * The ONE write boundary coordinating `FedosBoardRepository` (Alpha
 * 302/303), `FedosBoardSourceIndex` (Alpha 304), and `FedosBoardIndex`
 * (Alpha 305), applying the thread integrity rules named in Alpha 306.
 * No caller ever needs to call the three underlying components itself.
 *
 * `previewRegistration()` (Alpha 395): the same three pure-read checks
 * `registerPost()` already ran BEFORE its own first mutating call,
 * factored into a shared private `#precheckRegistration()` and exposed
 * publicly so `FedosDesktopHost.submitPost()`
 * (`../../desktop/host/fedos_desktop_host.js`, Alpha 395) can predict
 * whether a post is acceptable BEFORE committing it to durable
 * `FedosBoardPersistence` — which has no delete method (Alpha 315 §"No
 * `delete` method") to undo a later rejection here. This keeps
 * `FedosBoardService` completely unaware of `FedosBoardPersistence` —
 * `previewRegistration()` reads only `#repository`/`#sourceIndex`,
 * exactly like `registerPost()` always has.
 *
 * HARD GUARDRAILS:
 *   - No exceptions for normal rejection — every rejection is a
 *     RETURNED token; nothing here throws.
 *   - No partial writes: all checks are pure reads, run BEFORE the
 *     first mutating call (see this Stage's own design doc §3–§4 for
 *     why this guarantees atomicity with no transaction framework).
 *   - `previewRegistration()` is ITSELF a pure read — it calls neither
 *     `#repository.register()`, `#sourceIndex.register()`, nor
 *     `#boardIndex.register()`.
 *   - No Storage, Runtime, Desktop, protocol-adapter, or `p2p` import
 *     of any kind — `previewRegistration()` does not change this; it
 *     has no Persistence reference of any kind.
 */

import type { FedosBoardId, FedosBoardPostId, FedosThreadId } from "../fedos_board_identifiers.js";
import type { FedosBoardPost } from "../fedos_board_post.js";
import { InMemoryFedosBoardRepository } from "./in_memory_fedos_board_repository.js";
import {
  fedosBoardPostsAreStructurallyEqual,
  type FedosBoardRepository,
} from "./fedos_board_repository.js";
import type { FedosBoardReader } from "./fedos_board_reader.js";
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

export class FedosBoardService implements FedosBoardReader {
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
    // 1+2. Thread integrity (Alpha 306) + source provenance pre-check --
    // pure reads only, no mutation. Shared with previewRegistration()
    // (Alpha 395) via #precheckRegistration().
    const precheck = this.#precheckRegistration(post);
    if (precheck !== null) return precheck;

    // 3. Repository write -- the first mutating call.
    const repositoryResult = this.#repository.register(post);
    if (repositoryResult === "conflict") return "post-id-conflict"; // defensive: #precheckRegistration already predicted this above.

    // 4. Source Index + Board Index writes -- guaranteed consistent by
    // construction once step 3 succeeded (see design doc §4).
    this.#sourceIndex.register(post);
    this.#boardIndex.register(post);

    return repositoryResult;
  }

  /**
   * Alpha 395: pure-read prediction of what `registerPost(post)` would
   * return, WITHOUT calling it. Returns `null` when `post` would be
   * accepted (`"inserted"` or `"already-present"`); otherwise the exact
   * rejection token `registerPost()` would return. See this file's own
   * header §"previewRegistration()" for why `FedosDesktopHost.submitPost()`
   * needs this BEFORE writing to durable Persistence.
   */
  previewRegistration(post: FedosBoardPost): FedosBoardRegistrationResult | null {
    return this.#precheckRegistration(post);
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

  /**
   * PRIVATE (Alpha 395) -- every pure-read check `registerPost()` runs
   * BEFORE its own first mutating call, factored out so
   * `previewRegistration()` can predict the same outcome without
   * mutating anything. `null` means `post` would be accepted.
   */
  #precheckRegistration(post: FedosBoardPost): FedosBoardRegistrationResult | null {
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

    // 2b. Repository post-id pre-check (Alpha 395) -- pure read
    // equivalent of #repository.register()'s own conflict detection
    // (mirrors InMemoryFedosBoardRepository's own Map-get-then-compare,
    // Alpha 303), so a caller can know the eventual repository write
    // will not be "conflict" before ever attempting it.
    const existingById = this.#repository.findPost(post.id);
    if (existingById !== null && !fedosBoardPostsAreStructurallyEqual(existingById, post)) {
      return "post-id-conflict";
    }

    return null;
  }
}
