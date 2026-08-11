import { describe, it, expect } from "vitest";
import {
  createFedosDeliveryObservation,
  isFedosDeliveryObservationState,
  makeFedosDeliveryObservationId,
  toFedosDeliveryObservationSubjectId,
} from "../src/os/messenger/board/observation/fedos_delivery_observation.js";

/**
 * Secure Runtime Alpha 462 -- "Delivery Observation State Model": Stage 2
 * of the Alpha 461-470 Canonical Delivery Observation Arc.
 */
describe("Secure Runtime Alpha 462 -- Delivery Observation State Model", () => {
  const subjectId = toFedosDeliveryObservationSubjectId("subject-1")!;

  it("1. accepts exactly the five required states", () => {
    for (const state of ["queued", "publishing", "accepted", "rejected", "failed"]) {
      expect(isFedosDeliveryObservationState(state)).toBe(true);
    }
  });

  it("2. rejects any state outside the five", () => {
    for (const state of ["delivered", "attempt-started", "abandoned", "pending", ""]) {
      expect(isFedosDeliveryObservationState(state)).toBe(false);
    }
  });

  it("3. constructs a valid observation with the expected shape", () => {
    const observation = createFedosDeliveryObservation(subjectId, "queued", 1_700_000_000);
    expect(observation).not.toBeNull();
    expect(observation!.subjectId).toBe(subjectId);
    expect(observation!.state).toBe("queued");
    expect(observation!.observedAt).toBe(1_700_000_000);
    expect(observation!.id).toBe(makeFedosDeliveryObservationId(subjectId, "queued", 1_700_000_000));
    expect(observation!.reason).toBeUndefined();
  });

  it("4. carries an optional reason when supplied", () => {
    const observation = createFedosDeliveryObservation(subjectId, "rejected", 1, "duplicate event");
    expect(observation!.reason).toBe("duplicate event");
  });

  it("5. is Object.frozen -- mutation attempts are no-ops or throw", () => {
    const observation = createFedosDeliveryObservation(subjectId, "queued", 1)!;
    expect(Object.isFrozen(observation)).toBe(true);
  });

  it("6. two calls with logically identical inputs produce the identical id", () => {
    const a = createFedosDeliveryObservation(subjectId, "accepted", 42)!;
    const b = createFedosDeliveryObservation(subjectId, "accepted", 42)!;
    expect(a.id).toBe(b.id);
  });

  it("7. a different subjectId, state, or observedAt yields a different id", () => {
    const base = createFedosDeliveryObservation(subjectId, "accepted", 42)!;
    const otherSubject = createFedosDeliveryObservation(toFedosDeliveryObservationSubjectId("subject-2")!, "accepted", 42)!;
    const otherState = createFedosDeliveryObservation(subjectId, "failed", 42)!;
    const otherTime = createFedosDeliveryObservation(subjectId, "accepted", 43)!;
    expect(base.id).not.toBe(otherSubject.id);
    expect(base.id).not.toBe(otherState.id);
    expect(base.id).not.toBe(otherTime.id);
  });

  it("8. rejects an invalid state -- fails closed to null, never throws", () => {
    expect(() => createFedosDeliveryObservation(subjectId, "delivered" as never, 1)).not.toThrow();
    expect(createFedosDeliveryObservation(subjectId, "delivered" as never, 1)).toBeNull();
  });

  it("9. rejects a negative or non-integer observedAt -- fails closed to null", () => {
    expect(createFedosDeliveryObservation(subjectId, "queued", -1)).toBeNull();
    expect(createFedosDeliveryObservation(subjectId, "queued", 1.5)).toBeNull();
    expect(createFedosDeliveryObservation(subjectId, "queued", Number.NaN)).toBeNull();
  });

  it("10. rejects an empty-string reason -- fails closed to null", () => {
    expect(createFedosDeliveryObservation(subjectId, "queued", 1, "   ")).toBeNull();
  });

  it("11. toFedosDeliveryObservationSubjectId brands a non-empty string and rejects an empty one", () => {
    expect(toFedosDeliveryObservationSubjectId("post-1::nostr")).toBe("post-1::nostr");
    expect(toFedosDeliveryObservationSubjectId("   ")).toBeNull();
  });

  it("12. carries no retry/backoff/pool/protocol field of any kind -- structural key check", () => {
    const observation = createFedosDeliveryObservation(subjectId, "queued", 1)!;
    expect(Object.keys(observation).sort()).toEqual(["id", "observedAt", "state", "subjectId"]);
  });
});
