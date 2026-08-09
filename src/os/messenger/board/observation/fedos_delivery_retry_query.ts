/**
 * Secure Runtime Alpha 528 ("Retry Query") — Stage 8 of the Alpha
 * 521–540 Durable Delivery Retry Coordination Arc.
 *
 * The "Retry History"/"Current State"/"Retry Counter" read boundary
 * this Arc's own scope names — constructed from NOTHING but a
 * `FedosDeliveryObservationQuery` (`./fedos_delivery_observation_query.js`,
 * Alpha 467, UNCHANGED), the SAME instance `FedosDesktopHost.observationQuery()`
 * (Alpha 510, UNCHANGED — Host API変更禁止, honored: this file requires
 * ZERO change to `FedosDesktopHost`) already returns. A caller
 * constructs `new FedosDeliveryRetryQuery(host.observationQuery()!)`
 * directly; no new Host method exists or is needed.
 *
 * `historyFor()` walks attempt-scoped subject ids 1, 2, 3, … (Alpha
 * 525's own deterministic derivation) via `query.currentStateFor()`
 * until one returns `null` — the ABSENCE of attempt N+1 is itself the
 * signal that attempt N is the latest recorded one; no separate
 * counter is read here (`FedosDeliveryRetryRegistry`, Alpha 527, is a
 * WRITE-time-only concern this file never imports). Each attempt's own
 * `isFinal`/`retryReason` is decoded from its own terminal
 * Observation's `reason` field via `decodeFedosDeliveryRetryReason`
 * (Alpha 526, UNCHANGED) — an attempt still `"publishing"` is always
 * reported `isFinal: false`, regardless of what its own (not yet
 * written) `reason` might decode to.
 *
 * HARD GUARDRAILS:
 *   - `FedosDeliveryRetryQuery` and `FedosDeliveryRetryAttemptState`
 *     are the ONLY exports.
 *   - Read-only — no method on this class writes to the Observation
 *     Repository, Query, or any other store.
 *   - No `FedosDeliveryRetryRegistry`, `FedosPublishScheduler`, or
 *     Publisher import of any kind.
 */

import type { FedosDeliveryObservationQuery } from "./fedos_delivery_observation_query.js";
import type { FedosDeliveryObservationState, FedosDeliveryObservationSubjectId } from "./fedos_delivery_observation.js";
import { makeFedosDeliveryAttemptSubjectId } from "./fedos_delivery_attempt_subject_id.js";
import { decodeFedosDeliveryRetryReason } from "./fedos_delivery_retry_reason_codec.js";

export interface FedosDeliveryRetryAttemptState {
  readonly attemptNumber: number;
  readonly state: FedosDeliveryObservationState;
  readonly isFinal: boolean;
  readonly retryReason: string | null;
  readonly observedAt: number;
}

export class FedosDeliveryRetryQuery {
  readonly #query: FedosDeliveryObservationQuery;

  constructor(query: FedosDeliveryObservationQuery) {
    this.#query = query;
  }

  /** Every recorded attempt for `originalSubjectId`, oldest first, attempt 1 through the latest recorded attempt. */
  historyFor(originalSubjectId: FedosDeliveryObservationSubjectId): readonly FedosDeliveryRetryAttemptState[] {
    const attempts: FedosDeliveryRetryAttemptState[] = [];
    for (let attemptNumber = 1; ; attemptNumber++) {
      const attemptSubjectId = makeFedosDeliveryAttemptSubjectId(originalSubjectId, attemptNumber);
      if (attemptSubjectId === null) break;
      const current = this.#query.currentStateFor(attemptSubjectId);
      if (current === null) break;
      const decoded = decodeFedosDeliveryRetryReason(current.reason);
      attempts.push({
        attemptNumber,
        state: current.state,
        isFinal: current.state === "publishing" ? false : decoded.isFinal,
        retryReason: current.state === "publishing" ? null : decoded.detail,
        observedAt: current.observedAt,
      });
    }
    return attempts;
  }

  /** How many attempts have been recorded for `originalSubjectId` so far — `0` if none. */
  retryCountFor(originalSubjectId: FedosDeliveryObservationSubjectId): number {
    return this.historyFor(originalSubjectId).length;
  }

  /** The LATEST attempt's own state, or `null` if no attempt has been recorded yet. */
  currentStateFor(originalSubjectId: FedosDeliveryObservationSubjectId): FedosDeliveryRetryAttemptState | null {
    const history = this.historyFor(originalSubjectId);
    return history.length === 0 ? null : history[history.length - 1]!;
  }
}
