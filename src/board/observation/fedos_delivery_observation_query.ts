/**
 * Secure Runtime Alpha 467 ("Delivery Observation Query") — Stage 7 of
 * the Alpha 461–470 Canonical Delivery Observation Arc.
 *
 * `FedosDeliveryObservationQuery` is the canonical READ layer over
 * `FedosDeliveryObservationRepository`
 * (`./fedos_delivery_observation_repository.js`, Alpha 466) — the
 * Repository already owns storage; this class defines HOW clients read
 * it, mirroring `FedosBoardQuery`'s own identical relationship to the
 * Board Repository (`../query/fedos_board_query.ts`, Alpha 373–376).
 *
 * `historyFor()` orders `observedAt` ASC, `id` ASC on a tie — a
 * subject's own delivery history read in the order it actually
 * happened, oldest first, mirroring `FedosBoardQuery.thread()`'s own
 * Alpha 374 "read top-to-bottom in real order" rationale rather than its
 * `recentFeed()`'s newest-first rationale, since a delivery history is
 * read as a timeline, not a feed.
 *
 * `currentStateFor()` derives the SUBJECT'S current state as the last
 * entry of `historyFor()` — `null` if no Observation exists yet for that
 * `subjectId`. This is a DERIVED read, never a separately stored
 * "status" field — Alpha 462's own "Observations are derived historical
 * FACTS, never a mutable status" rule applies here exactly as it does to
 * storage.
 *
 * HARD GUARDRAILS:
 *   - Read-only — no method on this class writes to the Repository or
 *     Persistence layer.
 *   - No Board, Outbox, Publisher, Nostr, Relay, retry, backoff, pool, or
 *     GUI import of any kind anywhere in this file.
 *
 * Secure Runtime Alpha 7641-7720 — `historyFor()` now reads
 * `repository.listForSubject(subjectId)` (the new derived per-subject
 * index) instead of `repository.list()` + `.filter()` — O(subject's own
 * history length) instead of O(every Observation across every subject).
 * Ordering contract is BYTE-FOR-BYTE UNCHANGED: the same
 * `.sort(compareByObservedAtThenId)` still runs, since the index itself
 * is insertion-order, not chronological. `currentStateFor()` is
 * UNCHANGED (still derives from `historyFor()`'s own last element).
 * `listByState()` is UNCHANGED (still a genuinely cross-subject query,
 * correctly left on `repository.list()`'s own full scan).
 */

import type { FedosDeliveryObservation, FedosDeliveryObservationSubjectId } from "./fedos_delivery_observation.js";
import type { FedosDeliveryObservationRepository } from "./fedos_delivery_observation_repository.js";

function compareByObservedAtThenId(a: FedosDeliveryObservation, b: FedosDeliveryObservation): number {
  if (a.observedAt !== b.observedAt) return a.observedAt - b.observedAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export class FedosDeliveryObservationQuery {
  readonly #repository: FedosDeliveryObservationRepository;

  constructor(repository: FedosDeliveryObservationRepository) {
    this.#repository = repository;
  }

  /** Every Observation for `subjectId`, oldest first (`observedAt` ASC, `id` ASC on a tie). */
  historyFor(subjectId: FedosDeliveryObservationSubjectId): readonly FedosDeliveryObservation[] {
    return [...this.#repository.listForSubject(subjectId)].sort(compareByObservedAtThenId);
  }

  /** The most recently observed state for `subjectId`, or `null` if no Observation exists yet. */
  currentStateFor(subjectId: FedosDeliveryObservationSubjectId): FedosDeliveryObservation | null {
    const history = this.historyFor(subjectId);
    return history.length === 0 ? null : history[history.length - 1]!;
  }

  /** Every Observation currently in `state`, across every subject, oldest first. */
  listByState(state: FedosDeliveryObservation["state"]): readonly FedosDeliveryObservation[] {
    return this.#repository
      .list()
      .filter((observation) => observation.state === state)
      .sort(compareByObservedAtThenId);
  }
}
