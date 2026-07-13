/**
 * Secure Runtime Alpha 317 ("Persisted Board Repository Adapter") —
 * Stage 7 of the Alpha 311–320 Canonical Board Persistence Boundary
 * Arc.
 *
 * Bridges `FedosBoardPersistence` (`./fedos_board_persistence.js`,
 * Alpha 315) to the ALREADY-FROZEN `FedosBoardRepository` contract
 * (`../repository/fedos_board_repository.js`, Alpha 302, "MUST NOT be
 * redesigned") — so a persistence-backed repository can be used
 * anywhere an in-memory one already is, with NO change to
 * `FedosBoardService` (Alpha 307) or any other existing caller.
 *
 * HARD GUARDRAILS:
 *   - `register`/`findPost`/`listPosts` perform NO validation of their
 *     own beyond what `serializeFedosBoardPost`/`deserializeFedosBoardPost`
 *     (`./fedos_board_post_codec.js`, Alpha 314) already do.
 *   - `findPost` returns `null` on any invalid/corrupt record.
 *   - `listPosts()` implements Option B (strict fail-closed: empty
 *     array if ANY record is corrupt) to satisfy the frozen
 *     `FedosBoardRepository` signature; `listPostsDiagnostic()` (NOT
 *     part of that contract) implements Option C for callers who want
 *     partial visibility plus a corruption count — see this Stage's
 *     own design doc §5.
 *   - No repair, no mutation of corrupt records — both methods are
 *     pure reads.
 */

import type { FedosBoardPostId } from "../fedos_board_identifiers.js";
import type { FedosBoardPost } from "../fedos_board_post.js";
import type {
  FedosBoardRepository,
  FedosBoardRepositoryWriteResult,
} from "../repository/fedos_board_repository.js";
import { serializeFedosBoardPost, deserializeFedosBoardPost } from "./fedos_board_post_codec.js";
import type { FedosBoardPersistence } from "./fedos_board_persistence.js";

/** The Option C diagnostic result -- NOT part of `FedosBoardRepository`. See design doc §5. */
export interface FedosBoardRepositoryListDiagnostic {
  readonly posts: readonly FedosBoardPost[];
  readonly corruptRecordCount: number;
}

export class PersistedFedosBoardRepository implements FedosBoardRepository {
  readonly #persistence: FedosBoardPersistence;

  constructor(persistence: FedosBoardPersistence) {
    this.#persistence = persistence;
  }

  register(post: FedosBoardPost): FedosBoardRepositoryWriteResult {
    const record = serializeFedosBoardPost(post);
    const result = this.#persistence.putPost(record);
    if (result === "failed") {
      // Unreachable with InMemoryFedosBoardPersistence this Arc -- a
      // documented, deliberate, conservative mapping for a future
      // durable backend. See design doc §3a.
      return "conflict";
    }
    return result;
  }

  findPost(id: FedosBoardPostId): FedosBoardPost | null {
    const record = this.#persistence.getPost(id);
    if (record === null) return null;
    return deserializeFedosBoardPost(record);
  }

  listPosts(): readonly FedosBoardPost[] {
    const posts: FedosBoardPost[] = [];
    for (const record of this.#persistence.listPosts()) {
      const post = deserializeFedosBoardPost(record);
      if (post === null) return []; // Option B: strict fail-closed.
      posts.push(post);
    }
    return posts;
  }

  /** Option C: partial visibility plus an honest corruption count. NOT part of `FedosBoardRepository`. */
  listPostsDiagnostic(): FedosBoardRepositoryListDiagnostic {
    const posts: FedosBoardPost[] = [];
    let corruptRecordCount = 0;
    for (const record of this.#persistence.listPosts()) {
      const post = deserializeFedosBoardPost(record);
      if (post === null) {
        corruptRecordCount += 1;
      } else {
        posts.push(post);
      }
    }
    return { posts, corruptRecordCount };
  }
}
