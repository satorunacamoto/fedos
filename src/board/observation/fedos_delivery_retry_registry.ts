/**
 * Secure Runtime Alpha 527 ("Retry Registry") — Stage 7 of the Alpha
 * 521–540 Durable Delivery Retry Coordination Arc.
 *
 * The "Retry Counter" this Arc's own scope names — a plain, in-memory,
 * WRITE-TIME-ONLY allocator of the next attempt number for a given
 * original `FedosDeliveryObservationSubjectId`
 * (`./fedos_delivery_observation.js`, Alpha 462, UNCHANGED). Used
 * exclusively by `FedosHostDeliveryController`
 * (`../../desktop/host/fedos_host_delivery_controller.js`) to decide
 * which attempt-scoped subject id (Alpha 525) a newly-observed
 * `publishing`/terminal pair belongs to — never read by, or exposed
 * to, any query-side code (`FedosDeliveryRetryQuery`, Alpha 528,
 * re-derives everything it needs by walking attempt-scoped subject ids
 * through the ALREADY Host-exposed `FedosDeliveryObservationQuery`
 * alone, never through this registry) — this is why NO
 * `FedosDesktopHost` API change is needed anywhere in this Arc.
 *
 * HARD GUARDRAILS:
 *   - `FedosDeliveryRetryRegistry` is the ONLY export.
 *   - `nextAttemptNumber()` starts at `1` and increments by exactly `1`
 *     per call for the SAME subject — no gaps, no reuse, no reset
 *     method of any kind.
 *   - Independent instances never share state — no module-level
 *     mutable state exists in this file.
 *   - No persistence, no durability of any kind — this registry's own
 *     state is lost exactly when a `FedosHostDeliveryController`
 *     instance is (matching `FedosPublishScheduler`'s own Alpha 476
 *     `#delivered`/`#abandoned` Sets' identical in-memory-only
 *     lifetime).
 */

import type { FedosDeliveryObservationSubjectId } from "./fedos_delivery_observation.js";

export class FedosDeliveryRetryRegistry {
  readonly #counts = new Map<FedosDeliveryObservationSubjectId, number>();

  /** Allocates and returns the NEXT attempt number for `subjectId` — 1 on the first call, incrementing thereafter. */
  nextAttemptNumber(subjectId: FedosDeliveryObservationSubjectId): number {
    const next = (this.#counts.get(subjectId) ?? 0) + 1;
    this.#counts.set(subjectId, next);
    return next;
  }

  /** The number of attempts already allocated for `subjectId` — `0` if none yet. Never mutates. */
  currentAttemptCount(subjectId: FedosDeliveryObservationSubjectId): number {
    return this.#counts.get(subjectId) ?? 0;
  }
}
