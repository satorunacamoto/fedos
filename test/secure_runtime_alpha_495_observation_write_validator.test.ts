import { describe, it, expect } from "vitest";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { FedosDeliveryObservationQuery } from "../src/os/messenger/board/observation/fedos_delivery_observation_query.js";
import {
  FedosValidatingDeliveryObservationRepository,
  validateFedosDeliveryObservationTransition,
} from "../src/os/messenger/board/observation/fedos_delivery_observation_write_validator.js";
import { toFedosDeliveryObservationSubjectId } from "../src/os/messenger/board/observation/fedos_delivery_observation.js";

function makePipeline() {
  const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
  const query = new FedosDeliveryObservationQuery(repository);
  const validating = new FedosValidatingDeliveryObservationRepository(repository, query);
  return { repository, query, validating };
}

const subjectId = toFedosDeliveryObservationSubjectId("post-1::nostr")!;

describe("Secure Runtime Alpha 495 -- Observation Write Validator", () => {
  it("accepts a legal first observation (queued)", () => {
    const { validating } = makePipeline();
    expect(validating.record(subjectId, "queued", 1)).toBe("recorded");
  });

  it("accepts a legal first observation (publishing, no prior queued)", () => {
    const { validating } = makePipeline();
    expect(validating.record(subjectId, "publishing", 1)).toBe("recorded");
  });

  it("rejects an illegal first observation (a terminal state with no publishing)", () => {
    const { validating } = makePipeline();
    expect(validating.record(subjectId, "accepted", 1)).toBe("invalid-transition");
  });

  it("walks the full legal sequence: queued -> publishing -> accepted", () => {
    const { validating } = makePipeline();
    expect(validating.record(subjectId, "queued", 1)).toBe("recorded");
    expect(validating.record(subjectId, "publishing", 2)).toBe("recorded");
    expect(validating.record(subjectId, "accepted", 3)).toBe("recorded");
  });

  it("rejects a second terminal observation after the first (single-attempt model)", () => {
    const { validating } = makePipeline();
    validating.record(subjectId, "queued", 1);
    validating.record(subjectId, "publishing", 2);
    validating.record(subjectId, "accepted", 3);
    expect(validating.record(subjectId, "failed", 4)).toBe("invalid-transition");
  });

  it("rejects rejected -> accepted and accepted -> publishing explicitly", () => {
    const a = makePipeline();
    a.validating.record(subjectId, "publishing", 1);
    a.validating.record(subjectId, "rejected", 2);
    expect(a.validating.record(subjectId, "accepted", 3)).toBe("invalid-transition");

    const b = makePipeline();
    b.validating.record(subjectId, "publishing", 1);
    b.validating.record(subjectId, "accepted", 2);
    expect(b.validating.record(subjectId, "publishing", 3)).toBe("invalid-transition");
  });

  it("rejects a stale terminal observation that arrives with an earlier observedAt than the current fact", () => {
    const { validating } = makePipeline();
    validating.record(subjectId, "publishing", 10);
    validating.record(subjectId, "accepted", 20);
    // A late-arriving "failed" for an earlier moment must not silently
    // become -- or even be recorded as -- a new current state.
    const secondSubject = toFedosDeliveryObservationSubjectId("post-2::nostr")!;
    const { validating: v2 } = makePipeline();
    v2.record(secondSubject, "publishing", 10);
    expect(v2.record(secondSubject, "failed", 5)).toBe("stale");
  });

  it("an invalid or stale candidate never reaches the underlying Repository -- history is untouched", () => {
    const { repository, query, validating } = makePipeline();
    validating.record(subjectId, "publishing", 1);
    validating.record(subjectId, "accepted", 2);
    const before = repository.list().length;
    validating.record(subjectId, "failed", 100); // invalid: already terminal
    expect(repository.list().length).toBe(before);
    expect(query.currentStateFor(subjectId)?.state).toBe("accepted");
  });

  it("validateFedosDeliveryObservationTransition never throws and never writes", () => {
    const { repository, query } = makePipeline();
    expect(() =>
      validateFedosDeliveryObservationTransition(query, subjectId, { state: "accepted", observedAt: 1 }),
    ).not.toThrow();
    expect(repository.list()).toHaveLength(0);
  });

  it("the underlying FedosDeliveryObservationRepository/Query classes gain no BREAKING change (record/get/list unmodified; RECONCILED: Secure Runtime Alpha 7641-7720 adds ONE new, purely additive method, listForSubject(), the derived per-subject index accessor -- historyFor/currentStateFor/listByState keep their own identical signatures and behavior)", () => {
    const { repository, query } = makePipeline();
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(repository)).sort()).toEqual(
      ["constructor", "get", "list", "listForSubject", "record"].sort(),
    );
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(query)).sort()).toEqual(
      ["constructor", "currentStateFor", "historyFor", "listByState"].sort(),
    );
  });
});
