import { describe, it, expect } from "vitest";
import { FedosDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_repository.js";
import { FedosDeliveryObservationQuery } from "../src/board/observation/fedos_delivery_observation_query.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosValidatingDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_write_validator.js";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";
import { makeFedosDeliveryAttemptSubjectId } from "../src/board/observation/fedos_delivery_attempt_subject_id.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import transitionGraphSource from "../src/os/messenger/board/observation/fedos_delivery_observation_transition_graph.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import validatorSource from "../src/os/messenger/board/observation/fedos_delivery_observation_write_validator.ts?raw";

function makePipeline() {
  const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
  const query = new FedosDeliveryObservationQuery(repository);
  return new FedosValidatingDeliveryObservationRepository(repository, query);
}

describe("Secure Runtime Alpha 530 -- Validation Reuse Confirmation", () => {
  it("the transition graph and validator files are structurally unchanged (spot-check of their own Alpha 494/495 shape)", () => {
    expect(transitionGraphSource).toContain("export function isAllowedFedosDeliveryObservationTransition(");
    expect(validatorSource).toContain("export class FedosValidatingDeliveryObservationRepository {");
  });

  it("within ONE attempt, every prior illegal transition is still correctly rejected", () => {
    const validating = makePipeline();
    const attemptSubject = makeFedosDeliveryAttemptSubjectId(toFedosDeliveryObservationSubjectId("post-1")!, 1)!;

    validating.record(attemptSubject, "publishing", 1);
    validating.record(attemptSubject, "accepted", 2);
    expect(validating.record(attemptSubject, "publishing", 3)).toBe("invalid-transition");
    expect(validating.record(attemptSubject, "rejected", 4)).toBe("invalid-transition");
  });

  it("a stale terminal observation within one attempt is still correctly rejected", () => {
    const validating = makePipeline();
    const attemptSubject = makeFedosDeliveryAttemptSubjectId(toFedosDeliveryObservationSubjectId("post-2")!, 1)!;
    validating.record(attemptSubject, "publishing", 10);
    expect(validating.record(attemptSubject, "failed", 5)).toBe("stale");
  });

  it("across DIFFERENT attempts of the SAME original subject, each attempt's own publishing->terminal is independently legal", () => {
    const validating = makePipeline();
    const original = toFedosDeliveryObservationSubjectId("post-3")!;
    const attempt1 = makeFedosDeliveryAttemptSubjectId(original, 1)!;
    const attempt2 = makeFedosDeliveryAttemptSubjectId(original, 2)!;

    expect(validating.record(attempt1, "publishing", 1)).toBe("recorded");
    expect(validating.record(attempt1, "failed", 2)).toBe("recorded");
    // A SECOND publishing/terminal pair for a DIFFERENT attempt of the
    // SAME original subject -- this is exactly the case that was
    // "invalid-transition" before Alpha 521-540 (Alpha 514's own finding).
    expect(validating.record(attempt2, "publishing", 3)).toBe("recorded");
    expect(validating.record(attempt2, "accepted", 4)).toBe("recorded");
  });
});
