/**
 * Secure Runtime Alpha 318 ("Board Hydration and Index Rebuild") —
 * Stage 8 of the Alpha 311–320 Canonical Board Persistence Boundary
 * Arc.
 *
 * Loads a `FedosBoardPersistence`'s own persisted records BACK INTO a
 * fresh, fully in-memory `FedosBoardService`
 * (`../repository/fedos_board_service.js`, Alpha 307, UNMODIFIED
 * default components) — Source Index and Board/Thread Index are
 * rebuilt entirely as a side effect of that unmodified service's own
 * `registerPost`, never reimplemented here. See this Stage's own
 * design doc for the full ordering/corruption-policy rationale.
 *
 * HARD GUARDRAILS:
 *   - No partial service returned on corruption OR unresolvable thread
 *     integrity — either failure voids the whole hydration
 *     (`service: null`).
 *   - Deterministic, order-independent hydration: posts are sorted by
 *     `id` before registration, independent of the persistence
 *     backend's own iteration order.
 *   - A bounded topological pass (roots first, then replies as their
 *     parents become available) — no unbounded retry.
 *   - No network, no Relay, no ontology inference, no background task.
 */

import type { FedosBoardPost } from "../fedos_board_post.js";
import { FedosBoardService } from "../repository/fedos_board_service.js";
import { deserializeFedosBoardPost } from "./fedos_board_post_codec.js";
import type { FedosBoardPersistence } from "./fedos_board_persistence.js";

export type FedosBoardHydrationOutcome =
  | "hydrated"
  | "rejected-corrupt-record"
  | "rejected-unresolvable-thread-integrity";

export interface FedosBoardHydrationResult {
  readonly outcome: FedosBoardHydrationOutcome;
  readonly service: FedosBoardService | null;
  readonly registeredCount: number;
  readonly corruptRecordCount: number;
  readonly unresolvedCount: number;
}

function compareBoardPostIdAsc(a: FedosBoardPost, b: FedosBoardPost): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Registers `posts` into `service` in a bounded, deterministic
 * topological order: every root first, then repeated passes over the
 * remaining replies, registering any whose parent has become available
 * and re-queueing only those rejected specifically as
 * `"missing-parent"`. Terminates the moment a full pass makes zero
 * progress -- see design doc §6 for the termination proof.
 */
function registerPostsInDependencyOrder(
  service: FedosBoardService,
  posts: readonly FedosBoardPost[],
): { registeredCount: number; unresolvedCount: number } {
  const sorted = [...posts].sort(compareBoardPostIdAsc);
  const roots = sorted.filter((post) => post.replyTo === null);
  let pendingReplies = sorted.filter((post) => post.replyTo !== null);

  let registeredCount = 0;
  let unresolvedCount = 0;

  for (const root of roots) {
    const result = service.registerPost(root);
    if (result === "inserted" || result === "already-present") {
      registeredCount += 1;
    } else {
      unresolvedCount += 1;
    }
  }

  let madeProgress = true;
  while (pendingReplies.length > 0 && madeProgress) {
    madeProgress = false;
    const stillPending: FedosBoardPost[] = [];
    for (const reply of pendingReplies) {
      const result = service.registerPost(reply);
      if (result === "inserted" || result === "already-present") {
        registeredCount += 1;
        madeProgress = true;
      } else if (result === "missing-parent") {
        stillPending.push(reply);
      } else {
        unresolvedCount += 1; // genuinely rejected -- never retried
      }
    }
    pendingReplies = stillPending;
  }

  // Anything still pending once the pass converges is permanently
  // unresolvable via a deterministic topological pass alone.
  unresolvedCount += pendingReplies.length;

  return { registeredCount, unresolvedCount };
}

export function hydrateFedosBoardService(persistence: FedosBoardPersistence): FedosBoardHydrationResult {
  const records = persistence.listPosts();

  const posts: FedosBoardPost[] = [];
  let corruptRecordCount = 0;
  for (const record of records) {
    const post = deserializeFedosBoardPost(record);
    if (post === null) {
      corruptRecordCount += 1;
    } else {
      posts.push(post);
    }
  }
  if (corruptRecordCount > 0) {
    return {
      outcome: "rejected-corrupt-record",
      service: null,
      registeredCount: 0,
      corruptRecordCount,
      unresolvedCount: 0,
    };
  }

  const service = new FedosBoardService();
  const { registeredCount, unresolvedCount } = registerPostsInDependencyOrder(service, posts);

  if (unresolvedCount > 0) {
    return {
      outcome: "rejected-unresolvable-thread-integrity",
      service: null,
      registeredCount: 0,
      corruptRecordCount: 0,
      unresolvedCount,
    };
  }

  return {
    outcome: "hydrated",
    service,
    registeredCount,
    corruptRecordCount: 0,
    unresolvedCount: 0,
  };
}
