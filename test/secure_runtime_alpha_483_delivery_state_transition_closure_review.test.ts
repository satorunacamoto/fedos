import { describe, it, expect } from "vitest";
import {
  createFedosDeliveryObservation,
  toFedosDeliveryObservationSubjectId,
} from "../src/os/messenger/board/observation/fedos_delivery_observation.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationQuery } from "../src/os/messenger/board/observation/fedos_delivery_observation_query.js";
import { createFedosBoardOutboxObservation } from "../src/os/messenger/board/outbox/fedos_board_outbox_observation.js";

/**
 * Secure Runtime Alpha 483 -- "Delivery State Transition Closure
 * Review": Stage 3 of the Alpha 481-490 Publish Pipeline Integration
 * Review Arc. Exercises the REAL, unmodified production constructors
 * read-only, to demonstrate (not assert an opinion about) whether the
 * documented transition graph is enforced in code. Writes nothing to
 * disk; every persistence instance is local to a single test.
 */
describe("Secure Runtime Alpha 483 -- Delivery State Transition Closure Review", () => {
  const subjectId = toFedosDeliveryObservationSubjectId("subject-1")!;

  it("1. FedosDeliveryObservation accepts a semantically backwards sequence (failed, then queued) with no rejection", () => {
    const failedFirst = createFedosDeliveryObservation(subjectId, "failed", 1);
    const queuedAfter = createFedosDeliveryObservation(subjectId, "queued", 2);
    expect(failedFirst).not.toBeNull();
    expect(queuedAfter).not.toBeNull();
  });

  it("2. FedosBoardOutboxObservation accepts the same kind of backwards sequence (delivered, then attempt-started)", () => {
    const outboxId = "post-1::nostr::" as never;
    const deliveredFirst = createFedosBoardOutboxObservation(outboxId, "delivered", 1);
    const attemptAfter = createFedosBoardOutboxObservation(outboxId, "attempt-started", 2);
    expect(deliveredFirst).not.toBeNull();
    expect(attemptAfter).not.toBeNull();
  });

  it("3. FedosDeliveryObservationRepository.record() writes an out-of-order fact without consulting the current state first", () => {
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const query = new FedosDeliveryObservationQuery(repository);

    repository.record(subjectId, "accepted", 5);
    expect(query.currentStateFor(subjectId)!.state).toBe("accepted");

    // A later-arriving, chronologically-later "failed" fact silently overrides the derived current state --
    // the Repository performs no read-before-write consistency check against the terminal state already recorded.
    const result = repository.record(subjectId, "failed", 10);
    expect(result).toBe("recorded");
    expect(query.currentStateFor(subjectId)!.state).toBe("failed");
  });

  it("4. neither constructor accepts, or has any parameter for, the subject's prior state", () => {
    expect(createFedosDeliveryObservation.length).toBe(4); // subjectId, state, observedAt, reason
    expect(createFedosBoardOutboxObservation.length).toBe(4); // outboxId, kind, observedAt, reason
  });
});
