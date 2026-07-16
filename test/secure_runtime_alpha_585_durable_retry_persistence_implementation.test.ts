import { describe, it, expect } from "vitest";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import { FedosDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationQuery } from "../src/board/observation/fedos_delivery_observation_query.js";
import { FedosValidatingDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_write_validator.js";
import { FedosDeliveryRetryQuery } from "../src/board/observation/fedos_delivery_retry_query.js";
import { FedosDeliveryRetryRegistry } from "../src/board/observation/fedos_delivery_retry_registry.js";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";
import { makeFedosDeliveryAttemptSubjectId } from "../src/board/observation/fedos_delivery_attempt_subject_id.js";
import { hydrateFedosDeliveryRecoveryState } from "../src/desktop/host/fedos_delivery_recovery_hydration.js";

/**
 * Secure Runtime Alpha 585 -- "Durable Retry Persistence Implementation":
 * Stage 5 of the Alpha 581-600 Durable Retry Registry & Delivery
 * Recovery Arc. Unit-level verification of `hydrateFedosDeliveryRecoveryState()`
 * and `FedosDeliveryRetryRegistry.hydrateAttemptCount()`, independent
 * of the full Host pipeline (see Alpha 587-589 for that).
 */

function makePipeline() {
  const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
  const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
  const query = new FedosDeliveryObservationQuery(repository);
  const validating = new FedosValidatingDeliveryObservationRepository(repository, query);
  const retryQuery = new FedosDeliveryRetryQuery(query);
  return { outboxPersistence, repository, query, validating, retryQuery };
}

function putIntent(outboxPersistence: InMemoryFedosBoardOutboxPersistence, id: string) {
  const postId = toFedosBoardPostId(id)!;
  const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
  outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));
  return intent;
}

describe("Secure Runtime Alpha 585 -- Durable Retry Persistence Implementation", () => {
  it("1. an intent with no recorded history is absent from every recovery bucket", () => {
    const { outboxPersistence, retryQuery } = makePipeline();
    putIntent(outboxPersistence, "post-585-1");
    const state = hydrateFedosDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.size).toBe(0);
    expect(state.abandoned.size).toBe(0);
    expect(state.completedAttempts.size).toBe(0);
    expect(state.nextAttemptCountBySubject.size).toBe(0);
  });

  it("2. an intent whose latest recorded attempt is 'accepted' is recovered as delivered", () => {
    const { outboxPersistence, validating, retryQuery } = makePipeline();
    const intent = putIntent(outboxPersistence, "post-585-2");
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const attempt1 = makeFedosDeliveryAttemptSubjectId(subjectId, 1)!;
    validating.record(attempt1, "publishing", 1);
    validating.record(attempt1, "accepted", 2);

    const state = hydrateFedosDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.has(intent.id)).toBe(true);
    expect(state.abandoned.has(intent.id)).toBe(false);
    expect(state.nextAttemptCountBySubject.get(subjectId)).toBe(1);
  });

  it("3. an intent whose latest recorded attempt is terminal-but-not-accepted (isFinal) is recovered as abandoned", () => {
    const { outboxPersistence, validating, retryQuery } = makePipeline();
    const intent = putIntent(outboxPersistence, "post-585-3");
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const attempt1 = makeFedosDeliveryAttemptSubjectId(subjectId, 1)!;
    validating.record(attempt1, "publishing", 1);
    validating.record(attempt1, "rejected", 2, "final:policy-abandon");

    const state = hydrateFedosDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.abandoned.has(intent.id)).toBe(true);
    expect(state.delivered.has(intent.id)).toBe(false);
  });

  it("4. an intent still mid-retry (terminal but not final) is neither delivered nor abandoned, and its terminal attempt count is seeded", () => {
    const { outboxPersistence, validating, retryQuery } = makePipeline();
    const intent = putIntent(outboxPersistence, "post-585-4");
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const attempt1 = makeFedosDeliveryAttemptSubjectId(subjectId, 1)!;
    validating.record(attempt1, "publishing", 1);
    validating.record(attempt1, "failed", 2, "not-final:transient");

    const state = hydrateFedosDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.has(intent.id)).toBe(false);
    expect(state.abandoned.has(intent.id)).toBe(false);
    expect(state.completedAttempts.get(intent.id)).toBe(1);
    expect(state.nextAttemptCountBySubject.get(subjectId)).toBe(1);
  });

  it("5. an attempt still open ('publishing', no terminal write -- a mid-flight crash) contributes to nextAttemptCountBySubject but NOT to completedAttempts", () => {
    const { outboxPersistence, validating, retryQuery } = makePipeline();
    const intent = putIntent(outboxPersistence, "post-585-5");
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const attempt1 = makeFedosDeliveryAttemptSubjectId(subjectId, 1)!;
    validating.record(attempt1, "publishing", 1); // no terminal write -- simulates a crash mid-attempt

    const state = hydrateFedosDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.completedAttempts.has(intent.id)).toBe(false);
    expect(state.nextAttemptCountBySubject.get(subjectId)).toBe(1);
  });

  it("6. FedosDeliveryRetryRegistry.hydrateAttemptCount() only ever raises a count, never lowers one", () => {
    const registry = new FedosDeliveryRetryRegistry();
    const subjectId = toFedosDeliveryObservationSubjectId("subject-585-6")!;
    expect(registry.currentAttemptCount(subjectId)).toBe(0);

    registry.hydrateAttemptCount(subjectId, 5);
    expect(registry.currentAttemptCount(subjectId)).toBe(5);

    registry.hydrateAttemptCount(subjectId, 2); // lower -- ignored
    expect(registry.currentAttemptCount(subjectId)).toBe(5);

    registry.hydrateAttemptCount(subjectId, 9); // higher -- applied
    expect(registry.currentAttemptCount(subjectId)).toBe(9);

    // The next real allocation continues from the hydrated count -- no reuse.
    expect(registry.nextAttemptNumber(subjectId)).toBe(10);
  });

  it("7. a negative or non-integer count is rejected, never applied", () => {
    const registry = new FedosDeliveryRetryRegistry();
    const subjectId = toFedosDeliveryObservationSubjectId("subject-585-7")!;
    registry.hydrateAttemptCount(subjectId, -1);
    registry.hydrateAttemptCount(subjectId, 1.5);
    registry.hydrateAttemptCount(subjectId, Number.NaN);
    expect(registry.currentAttemptCount(subjectId)).toBe(0);
  });
});
