/**
 * Secure Runtime Alpha 304 ("Board Source Provenance Deduplication
 * Index") — Stage 4 of the Alpha 301–310 Canonical Board Repository,
 * Index & Feed Foundation Arc.
 *
 * Recognizes that the same upstream object may be imported more than
 * once, keyed by `protocol + source.reference` via `fedosBoardSourceKey`
 * (`../fedos_board_source.js`, Alpha 253) — reused directly, unmodified.
 *
 * HARD GUARDRAILS:
 *   - No automatic merge — a conflict is reported, never resolved.
 *   - No post mutation — stores only `FedosBoardPostId` values, never a
 *     `FedosBoardPost` reference.
 *   - No protocol parsing, no network, no storage.
 *   - Repository ID conflict (Alpha 302/303) and Source provenance
 *     conflict are SEPARATE facts — this class knows nothing about
 *     `FedosBoardRepositoryWriteResult` and never collapses the two
 *     into one boolean (see this Stage's own design doc §4).
 */

import type { FedosBoardPostId } from "../fedos_board_identifiers.js";
import type { FedosBoardPost } from "../fedos_board_post.js";
import { fedosBoardSourceKey, type FedosBoardSourceReference } from "../fedos_board_source.js";

export type FedosBoardSourceIndexWriteResult = "inserted" | "already-present" | "conflict";

export class FedosBoardSourceIndex {
  readonly #bySource = new Map<string, FedosBoardPostId>();

  register(post: FedosBoardPost): FedosBoardSourceIndexWriteResult {
    const key = fedosBoardSourceKey(post.source);
    const existing = this.#bySource.get(key);
    if (existing === undefined) {
      this.#bySource.set(key, post.id);
      return "inserted";
    }
    if (existing === post.id) {
      return "already-present";
    }
    return "conflict";
  }

  findBySource(source: FedosBoardSourceReference): FedosBoardPostId | null {
    return this.#bySource.get(fedosBoardSourceKey(source)) ?? null;
  }
}
