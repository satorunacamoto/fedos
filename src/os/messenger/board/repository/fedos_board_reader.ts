/**
 * Secure Runtime Alpha 403 ("Read-Only Board Access Model") — Stage 3
 * of the Alpha 401–410 Desktop Host Canonical Write Boundary Closure
 * Arc.
 *
 * The smallest honest read-only Board access contract: direct
 * canonical lookup and grouping ONLY — `findPost()`/`listBoardPosts()`/
 * `listThreadPosts()`, the exact three read methods `FedosBoardService`
 * (`./fedos_board_service.js`, Alpha 307) already exposes alongside its
 * own mutating `registerPost()`/`previewRegistration()` (Alpha 395).
 * Deliberately does NOT duplicate `FedosBoardQuery`'s own ordering,
 * filtering, or pagination (`../query/fedos_board_query.js`, Alpha
 * 373–376) — that remains Query's own, separately-scoped job; this
 * contract is for direct lookup and grouping only, matching Alpha
 * 385's own frozen "application writes and direct canonical lookup"
 * (write side, now closed) vs. "filtering, ordering, pagination, feed
 * and thread reads" (Query's own permanent scope) distinction.
 *
 * `FedosBoardServiceReader` (Alpha 404's own caller) is the concrete
 * wrapper `FedosDesktopHost.board()` returns — a genuine, real
 * forwarding object, NOT a type-narrowed reference to the same
 * `FedosBoardService` instance. This distinction is load-bearing: a
 * `FedosBoardService` instance re-typed as `FedosBoardReader` would
 * still be, at runtime, an object whose `registerPost` method exists
 * and remains callable via any unsafe cast — TypeScript's structural
 * typing erases nothing at runtime. `FedosBoardServiceReader` instead
 * holds a reference to the underlying reader and forwards exactly
 * three calls — the returned object's OWN public surface, inspected
 * directly (`Object.keys`/`typeof obj.registerPost`), never has a
 * `registerPost` property at all, closing the bypass at the object
 * level, not merely the type level (see
 * `docs/secure_runtime_alpha_408_host_write_failure_boundary_verification.md`
 * §"the actual public object surface").
 *
 * HARD GUARDRAILS:
 *   - `FedosBoardReader` and `FedosBoardServiceReader` are the ONLY
 *     exports.
 *   - `FedosBoardReader` declares EXACTLY three methods:
 *     `findPost`/`listBoardPosts`/`listThreadPosts` — no `registerPost`,
 *     no `previewRegistration`, no Repository/Index/Persistence
 *     reference of any kind, no protocol-specific method, no network,
 *     no background work.
 *   - `FedosBoardServiceReader`'s constructor performs NO I/O — it only
 *     stores the given `FedosBoardReader` reference, matching this
 *     repository's own established "no constructor side effects"
 *     convention.
 *   - Every `FedosBoardServiceReader` method is a ONE-LINE forward to
 *     the underlying reader — no caching, no snapshotting, no copying.
 *     The returned data is always read live from whatever object the
 *     wrapper was constructed with — never stale.
 */

import type { FedosBoardId, FedosBoardPostId, FedosThreadId } from "../fedos_board_identifiers.js";
import type { FedosBoardPost } from "../fedos_board_post.js";

export interface FedosBoardReader {
  findPost(id: FedosBoardPostId): FedosBoardPost | null;
  listBoardPosts(boardId: FedosBoardId): readonly FedosBoardPost[];
  listThreadPosts(boardId: FedosBoardId, threadId: FedosThreadId): readonly FedosBoardPost[];
}

export class FedosBoardServiceReader implements FedosBoardReader {
  readonly #source: FedosBoardReader;

  constructor(source: FedosBoardReader) {
    this.#source = source;
  }

  findPost(id: FedosBoardPostId): FedosBoardPost | null {
    return this.#source.findPost(id);
  }

  listBoardPosts(boardId: FedosBoardId): readonly FedosBoardPost[] {
    return this.#source.listBoardPosts(boardId);
  }

  listThreadPosts(boardId: FedosBoardId, threadId: FedosThreadId): readonly FedosBoardPost[] {
    return this.#source.listThreadPosts(boardId, threadId);
  }
}
