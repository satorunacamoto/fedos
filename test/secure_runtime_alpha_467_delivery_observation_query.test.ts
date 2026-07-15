import { describe, it, expect } from "vitest";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";
import { FedosDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationQuery } from "../src/board/observation/fedos_delivery_observation_query.js";

/**
 * Secure Runtime Alpha 467 -- "Delivery Observation Query": Stage 7 of
 * the Alpha 461-470 Canonical Delivery Observation Arc.
 */
describe("Secure Runtime Alpha 467 -- Delivery Observation Query", () => {
  const subjectA = toFedosDeliveryObservationSubjectId("subject-a")!;
  const subjectB = toFedosDeliveryObservationSubjectId("subject-b")!;

  function makeQuery(): { repository: FedosDeliveryObservationRepository; query: FedosDeliveryObservationQuery } {
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    return { repository, query: new FedosDeliveryObservationQuery(repository) };
  }

  it("1. historyFor returns every observation for a subject, oldest first", () => {
    const { repository, query } = makeQuery();
    repository.record(subjectA, "accepted", 3);
    repository.record(subjectA, "queued", 1);
    repository.record(subjectA, "publishing", 2);
    const history = query.historyFor(subjectA);
    expect(history.map((o) => o.state)).toEqual(["queued", "publishing", "accepted"]);
  });

  it("2. historyFor excludes observations for other subjects", () => {
    const { repository, query } = makeQuery();
    repository.record(subjectA, "queued", 1);
    repository.record(subjectB, "queued", 1);
    expect(query.historyFor(subjectA)).toHaveLength(1);
  });

  it("3. historyFor breaks a tie in observedAt by id ascending", () => {
    const { repository, query } = makeQuery();
    repository.record(subjectA, "queued", 1);
    repository.record(subjectA, "publishing", 1);
    const history = query.historyFor(subjectA);
    expect(history).toHaveLength(2);
    expect(history[0]!.id < history[1]!.id).toBe(true);
  });

  it("4. currentStateFor returns null when no observation exists yet", () => {
    const { query } = makeQuery();
    expect(query.currentStateFor(subjectA)).toBeNull();
  });

  it("5. currentStateFor returns the most recently observed state", () => {
    const { repository, query } = makeQuery();
    repository.record(subjectA, "queued", 1);
    repository.record(subjectA, "publishing", 2);
    repository.record(subjectA, "rejected", 3);
    expect(query.currentStateFor(subjectA)!.state).toBe("rejected");
  });

  it("6. currentStateFor is a derived read -- recording an older observedAt after a newer one does not move it", () => {
    const { repository, query } = makeQuery();
    repository.record(subjectA, "accepted", 10);
    repository.record(subjectA, "queued", 1);
    expect(query.currentStateFor(subjectA)!.state).toBe("accepted");
  });

  it("7. listByState returns every observation in that state across subjects, oldest first", () => {
    const { repository, query } = makeQuery();
    repository.record(subjectA, "failed", 5);
    repository.record(subjectB, "failed", 1);
    repository.record(subjectA, "queued", 1);
    const failed = query.listByState("failed");
    expect(failed.map((o) => o.subjectId)).toEqual([subjectB, subjectA]);
  });

  it("8. is read-only -- no method mutates the underlying Repository/Persistence", () => {
    const { repository, query } = makeQuery();
    repository.record(subjectA, "queued", 1);
    query.historyFor(subjectA);
    query.currentStateFor(subjectA);
    query.listByState("queued");
    expect(repository.list()).toHaveLength(1);
  });
});
