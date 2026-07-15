import { describe, it, expect } from "vitest";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";
import { FedosDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/board/observation/in_memory_fedos_delivery_observation_persistence.js";

/**
 * Secure Runtime Alpha 466 -- "Delivery Observation Repository": Stage 6
 * of the Alpha 461-470 Canonical Delivery Observation Arc.
 */
describe("Secure Runtime Alpha 466 -- Delivery Observation Repository", () => {
  const subjectId = toFedosDeliveryObservationSubjectId("subject-1")!;

  function makeRepository(): FedosDeliveryObservationRepository {
    return new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
  }

  it("1. record() persists a valid observation and returns recorded", () => {
    const repository = makeRepository();
    expect(repository.record(subjectId, "queued", 1)).toBe("recorded");
    expect(repository.list()).toHaveLength(1);
  });

  it("2. record() with the identical logical fact twice is idempotent (already-present)", () => {
    const repository = makeRepository();
    repository.record(subjectId, "queued", 1);
    expect(repository.record(subjectId, "queued", 1)).toBe("already-present");
    expect(repository.list()).toHaveLength(1);
  });

  it("3. record() with an invalid state fails closed to invalid, never throws", () => {
    const repository = makeRepository();
    expect(() => repository.record(subjectId, "delivered" as never, 1)).not.toThrow();
    expect(repository.record(subjectId, "delivered" as never, 1)).toBe("invalid");
    expect(repository.list()).toHaveLength(0);
  });

  it("4. get() returns the recorded observation by id", () => {
    const repository = makeRepository();
    repository.record(subjectId, "queued", 1);
    const observation = repository.list()[0]!;
    expect(repository.get(observation.id)).toEqual(observation);
  });

  it("5. get() returns null for an unknown id", () => {
    const repository = makeRepository();
    expect(repository.get("nope")).toBeNull();
  });

  it("6. never overwrites a prior Observation -- distinct states/times each yield a separate row", () => {
    const repository = makeRepository();
    repository.record(subjectId, "queued", 1);
    repository.record(subjectId, "publishing", 2);
    repository.record(subjectId, "accepted", 3);
    expect(repository.list()).toHaveLength(3);
  });

  it("7. carries no retry/backoff/pool/Publisher-result field of any kind -- structural key check", () => {
    const repository = makeRepository();
    repository.record(subjectId, "queued", 1);
    expect(Object.keys(repository.list()[0]!).sort()).toEqual(["id", "observedAt", "state", "subjectId"]);
  });
});
