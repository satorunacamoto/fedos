import { describe, it, expect } from "vitest";
import { FedosDeliveryRetryQuery } from "../src/board/observation/fedos_delivery_retry_query.js";
import { FedosDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_repository.js";
import { FedosDeliveryObservationQuery } from "../src/board/observation/fedos_delivery_observation_query.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";
import { makeFedosDeliveryAttemptSubjectId } from "../src/board/observation/fedos_delivery_attempt_subject_id.js";
import { encodeFedosDeliveryRetryReason } from "../src/board/observation/fedos_delivery_retry_reason_codec.js";

function makePipeline() {
  const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
  const query = new FedosDeliveryObservationQuery(repository);
  return { repository, query, retryQuery: new FedosDeliveryRetryQuery(query) };
}

describe("Secure Runtime Alpha 528 -- Retry Query Implementation", () => {
  it("historyFor()/retryCountFor()/currentStateFor() are all empty/null for an unknown subject", () => {
    const { retryQuery } = makePipeline();
    const subject = toFedosDeliveryObservationSubjectId("post-1")!;
    expect(retryQuery.historyFor(subject)).toEqual([]);
    expect(retryQuery.retryCountFor(subject)).toBe(0);
    expect(retryQuery.currentStateFor(subject)).toBeNull();
  });

  it("a single successful attempt: history has one entry, current state is accepted and final", () => {
    const { repository, retryQuery } = makePipeline();
    const subject = toFedosDeliveryObservationSubjectId("post-1")!;
    const attempt1 = makeFedosDeliveryAttemptSubjectId(subject, 1)!;
    repository.record(attempt1, "publishing", 1);
    repository.record(attempt1, "accepted", 2, encodeFedosDeliveryRetryReason(true, null));

    const history = retryQuery.historyFor(subject);
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual({ attemptNumber: 1, state: "accepted", isFinal: true, retryReason: null, observedAt: 2 });
    expect(retryQuery.retryCountFor(subject)).toBe(1);
    expect(retryQuery.currentStateFor(subject)).toEqual(history[0]);
  });

  it("a failed-then-accepted chain: two attempts, first non-final failed, second final accepted", () => {
    const { repository, retryQuery } = makePipeline();
    const subject = toFedosDeliveryObservationSubjectId("post-2")!;
    const attempt1 = makeFedosDeliveryAttemptSubjectId(subject, 1)!;
    const attempt2 = makeFedosDeliveryAttemptSubjectId(subject, 2)!;
    repository.record(attempt1, "publishing", 1);
    repository.record(attempt1, "failed", 2, encodeFedosDeliveryRetryReason(false, "transport timeout"));
    repository.record(attempt2, "publishing", 3);
    repository.record(attempt2, "accepted", 4, encodeFedosDeliveryRetryReason(true, null));

    const history = retryQuery.historyFor(subject);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({
      attemptNumber: 1,
      state: "failed",
      isFinal: false,
      retryReason: "transport timeout",
      observedAt: 2,
    });
    expect(history[1]).toEqual({ attemptNumber: 2, state: "accepted", isFinal: true, retryReason: null, observedAt: 4 });
    expect(retryQuery.retryCountFor(subject)).toBe(2);
    expect(retryQuery.currentStateFor(subject)).toEqual(history[1]);
  });

  it("an in-flight (still publishing) latest attempt always reports isFinal: false regardless of its own reason", () => {
    const { repository, retryQuery } = makePipeline();
    const subject = toFedosDeliveryObservationSubjectId("post-3")!;
    const attempt1 = makeFedosDeliveryAttemptSubjectId(subject, 1)!;
    repository.record(attempt1, "publishing", 1);

    const current = retryQuery.currentStateFor(subject);
    expect(current).toEqual({ attemptNumber: 1, state: "publishing", isFinal: false, retryReason: null, observedAt: 1 });
  });

  it("independent subjects never cross-contaminate their own history", () => {
    const { repository, retryQuery } = makePipeline();
    const subjectA = toFedosDeliveryObservationSubjectId("post-a")!;
    const subjectB = toFedosDeliveryObservationSubjectId("post-b")!;
    const attemptA1 = makeFedosDeliveryAttemptSubjectId(subjectA, 1)!;
    repository.record(attemptA1, "publishing", 1);
    repository.record(attemptA1, "accepted", 2, encodeFedosDeliveryRetryReason(true, null));

    expect(retryQuery.historyFor(subjectB)).toEqual([]);
    expect(retryQuery.historyFor(subjectA)).toHaveLength(1);
  });
});
