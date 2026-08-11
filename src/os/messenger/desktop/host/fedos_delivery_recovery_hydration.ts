/**
 * Secure Runtime Alpha 585 ("Durable Retry Persistence Implementation")
 * — Stage 5 of the Alpha 581–600 Durable Retry Registry & Delivery
 * Recovery Arc.
 *
 * `hydrateFedosDeliveryRecoveryState()` derives `FedosPublishScheduler`'s
 * own startup recovery state (`initialDelivered`/`initialAbandoned`/
 * `initialCompletedAttempts`, Alpha 585, `../../board/outbox/fedos_publish_scheduler.js`)
 * and `FedosDeliveryRetryRegistry`'s own attempt-count seed (Alpha 586,
 * `../../board/observation/fedos_delivery_retry_registry.js`) FROM the
 * EXISTING durable Observation history alone
 * (`FedosDeliveryRetryQuery.historyFor()`, Alpha 528, UNCHANGED) — per
 * Alpha 582's own canonical-ownership decision, this file introduces NO
 * new persistence backend, NO new schema, and NO new npm dependency. It
 * reads; it never writes.
 *
 * Mirrors `hydrateFedosBoardService()`'s own established role
 * (`../../board/persistence/fedos_board_hydration.ts`, Alpha 318) —
 * "rebuild fresh in-memory state from a durable backend at startup" —
 * but, unlike Board hydration, is PER-INTENT independent (no
 * cross-intent thread-integrity concern exists for delivery state), so
 * one intent's own unreadable history never voids recovery for any
 * other intent (see `docs/secure_runtime_alpha_584_recovery_lifecycle_design.md`
 * §"Fail Closed, per intent").
 *
 * `createFedosDeliveryScheduler()` is the ONE function
 * `FedosDesktopHost.startDelivery()` actually calls — Secure Runtime
 * Alpha 522's own established boundary
 * (`docs/secure_runtime_alpha_522_retry_coordination_scope_decision.md`,
 * re-confirmed by `test/secure_runtime_alpha_522_...test.ts` line 26)
 * requires `fedos_desktop_host.ts`'s own source text to never mention
 * `FedosDeliveryRetryQuery`/attempt-subject-id concepts directly — only
 * `FedosHostDeliveryController` (and now this file, its own sibling)
 * may. `createFedosDeliveryScheduler()` hydrates (this file's own
 * `hydrateFedosDeliveryRecoveryState`), applies the retry-registry seed
 * as a side effect, and returns a fully-seeded `FedosPublishScheduler`
 * — Host's own call site never imports or names `FedosDeliveryRetryQuery`
 * itself.
 *
 * HARD GUARDRAILS:
 *   - `hydrateFedosDeliveryRecoveryState`, `FedosDeliveryRecoveryState`,
 *     and `createFedosDeliveryScheduler` are the ONLY exports.
 *   - Read-only against Persistence/Repository/Query — the ONE write
 *     this file performs anywhere is `FedosDeliveryRetryRegistry.hydrateAttemptCount()`
 *     (Alpha 586, itself additive-only, never-downward — see that
 *     method's own guardrail).
 *   - Never throws — an unreadable/corrupt history for one intent is
 *     treated as "no recorded history," the SAME conservative fallback
 *     an intent that was never attempted at all already gets (see
 *     "Fail Closed" below).
 *   - No Publisher, Relay, Nostr, protocol-specific, p2p, or GUI import
 *     of any kind.
 *
 * Fail Closed, restated precisely: a delivery-history read failure for
 * one intent NEVER marks that intent `delivered` or `abandoned` — it is
 * left exactly as if no history existed, so the Scheduler treats it as
 * still pending and retries it. Marking an unread intent "delivered" or
 * "abandoned" would be the UNSAFE direction (silent data loss or
 * silent stuck intent); leaving it pending costs, at most, one
 * redundant-but-safe extra attempt.
 */

import type { FedosBoardOutboxPersistence } from "../../board/outbox/fedos_board_outbox_persistence.js";
import type { FedosBoardOutboxPublisher } from "../../board/outbox/fedos_board_outbox_publisher.js";
import { FedosPublishScheduler } from "../../board/outbox/fedos_publish_scheduler.js";
import type { FedosDeliveryAbandonmentPolicy } from "../../board/outbox/fedos_board_outbox_abandonment_policy.js";
import { toFedosDeliveryObservationSubjectId, type FedosDeliveryObservationSubjectId } from "../../board/observation/fedos_delivery_observation.js";
import { FedosDeliveryObservationQuery } from "../../board/observation/fedos_delivery_observation_query.js";
import type { FedosDeliveryObservationRepository } from "../../board/observation/fedos_delivery_observation_repository.js";
import { FedosDeliveryRetryQuery, type FedosDeliveryRetryAttemptState } from "../../board/observation/fedos_delivery_retry_query.js";
import type { FedosDeliveryRetryRegistry } from "../../board/observation/fedos_delivery_retry_registry.js";

export interface FedosDeliveryRecoveryState {
  /** Outbox intent ids (`FedosBoardOutboxId`, read as plain `string`) whose latest recorded attempt is `"accepted"`. */
  readonly delivered: ReadonlySet<string>;
  /** Outbox intent ids whose latest recorded attempt is terminal (`isFinal`) but NOT `"accepted"` — Publisher-`"never"` or abandonment-policy `"abandon"`, indistinguishable by design (Alpha 567, unchanged). */
  readonly abandoned: ReadonlySet<string>;
  /** Outbox intent ids still genuinely pending, mapped to their own count of TERMINAL (non-`"publishing"`) recorded attempts so far. */
  readonly completedAttempts: ReadonlyMap<string, number>;
  /** Every subject with at least one recorded attempt, mapped to its own recorded attempt COUNT — the seed `FedosDeliveryRetryRegistry.hydrateAttemptCount()` consumes. */
  readonly nextAttemptCountBySubject: ReadonlyMap<FedosDeliveryObservationSubjectId, number>;
}

function historyForSafe(
  retryQuery: FedosDeliveryRetryQuery,
  subjectId: FedosDeliveryObservationSubjectId,
): readonly FedosDeliveryRetryAttemptState[] {
  try {
    return retryQuery.historyFor(subjectId);
  } catch {
    return [];
  }
}

export function hydrateFedosDeliveryRecoveryState(
  outboxPersistence: FedosBoardOutboxPersistence,
  retryQuery: FedosDeliveryRetryQuery,
): FedosDeliveryRecoveryState {
  const delivered = new Set<string>();
  const abandoned = new Set<string>();
  const completedAttempts = new Map<string, number>();
  const nextAttemptCountBySubject = new Map<FedosDeliveryObservationSubjectId, number>();

  for (const intent of outboxPersistence.listIntents()) {
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id);
    if (subjectId === null) continue;

    const history = historyForSafe(retryQuery, subjectId);
    if (history.length === 0) continue;

    nextAttemptCountBySubject.set(subjectId, history.length);

    const latest = history[history.length - 1]!;
    if (latest.state === "accepted") {
      delivered.add(intent.id);
      continue;
    }
    if (latest.isFinal) {
      abandoned.add(intent.id);
      continue;
    }

    const terminalCount = history.filter((attempt) => attempt.state !== "publishing").length;
    if (terminalCount > 0) completedAttempts.set(intent.id, terminalCount);
  }

  return { delivered, abandoned, completedAttempts, nextAttemptCountBySubject };
}

export interface FedosDeliverySchedulerCreationDependencies {
  readonly outboxPersistence: FedosBoardOutboxPersistence;
  readonly publisher: FedosBoardOutboxPublisher;
  readonly intervalMs: number;
  readonly observationRepository: FedosDeliveryObservationRepository;
  readonly retryRegistry: FedosDeliveryRetryRegistry;
  readonly abandonmentPolicy?: FedosDeliveryAbandonmentPolicy;
}

/**
 * Alpha 586 — hydrates recovery state from `observationRepository`'s
 * own durable history, seeds `retryRegistry` (side effect, additive-
 * only per `hydrateAttemptCount()`'s own guardrail), and returns a
 * FRESH `FedosPublishScheduler` constructed with that state as its own
 * `initialDelivered`/`initialAbandoned`/`initialCompletedAttempts`
 * (Alpha 585). The ONE call `FedosDesktopHost.startDelivery()` makes.
 */
export function createFedosDeliveryScheduler(
  dependencies: FedosDeliverySchedulerCreationDependencies,
): FedosPublishScheduler {
  const retryQuery = new FedosDeliveryRetryQuery(new FedosDeliveryObservationQuery(dependencies.observationRepository));
  const recoveryState = hydrateFedosDeliveryRecoveryState(dependencies.outboxPersistence, retryQuery);

  for (const [subjectId, count] of recoveryState.nextAttemptCountBySubject) {
    dependencies.retryRegistry.hydrateAttemptCount(subjectId, count);
  }

  return new FedosPublishScheduler({
    outboxPersistence: dependencies.outboxPersistence,
    publisher: dependencies.publisher,
    intervalMs: dependencies.intervalMs,
    abandonmentPolicy: dependencies.abandonmentPolicy,
    initialDelivered: recoveryState.delivered,
    initialAbandoned: recoveryState.abandoned,
    initialCompletedAttempts: recoveryState.completedAttempts,
  });
}
