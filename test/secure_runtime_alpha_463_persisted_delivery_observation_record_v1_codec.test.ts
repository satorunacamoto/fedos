import { describe, it, expect } from "vitest";
import {
  createFedosDeliveryObservation,
  toFedosDeliveryObservationSubjectId,
} from "../src/os/messenger/board/observation/fedos_delivery_observation.js";
import {
  deserializeFedosDeliveryObservation,
  serializeFedosDeliveryObservation,
} from "../src/os/messenger/board/observation/fedos_delivery_observation_codec.js";

/**
 * Secure Runtime Alpha 463 -- "Persisted Delivery Observation Record V1
 * and Codec": Stage 3 of the Alpha 461-470 Canonical Delivery Observation
 * Arc.
 */
describe("Secure Runtime Alpha 463 -- Persisted Delivery Observation Record V1 and Codec", () => {
  const subjectId = toFedosDeliveryObservationSubjectId("subject-1")!;

  it("1. round-trips a valid observation without a reason", () => {
    const observation = createFedosDeliveryObservation(subjectId, "queued", 1_700_000_000)!;
    const record = serializeFedosDeliveryObservation(observation);
    expect(record).toEqual({
      schemaVersion: 1,
      id: observation.id,
      subjectId: observation.subjectId,
      state: "queued",
      observedAt: 1_700_000_000,
    });
    expect(deserializeFedosDeliveryObservation(record)).toEqual(observation);
  });

  it("2. round-trips a valid observation with a reason", () => {
    const observation = createFedosDeliveryObservation(subjectId, "failed", 1, "timeout")!;
    const record = serializeFedosDeliveryObservation(observation);
    expect(record.reason).toBe("timeout");
    expect(deserializeFedosDeliveryObservation(record)).toEqual(observation);
  });

  it("3. serialize never shares a reference with the observation", () => {
    const observation = createFedosDeliveryObservation(subjectId, "queued", 1)!;
    const record = serializeFedosDeliveryObservation(observation);
    expect(record).not.toBe(observation);
  });

  it("4. deserialize rejects an unrecognized schemaVersion", () => {
    expect(
      deserializeFedosDeliveryObservation({ schemaVersion: 2, id: "x", subjectId: "s", state: "queued", observedAt: 1 }),
    ).toBeNull();
  });

  it("5. deserialize rejects an unknown top-level field", () => {
    expect(
      deserializeFedosDeliveryObservation({
        schemaVersion: 1,
        id: "s::queued::1",
        subjectId: "s",
        state: "queued",
        observedAt: 1,
        extra: "nope",
      }),
    ).toBeNull();
  });

  it("6. deserialize rejects a stored id that does not match the re-derived id", () => {
    expect(
      deserializeFedosDeliveryObservation({
        schemaVersion: 1,
        id: "tampered-id",
        subjectId: "s",
        state: "queued",
        observedAt: 1,
      }),
    ).toBeNull();
  });

  it("7. deserialize rejects an invalid state, never throws", () => {
    const record = { schemaVersion: 1, id: "s::delivered::1", subjectId: "s", state: "delivered", observedAt: 1 };
    expect(() => deserializeFedosDeliveryObservation(record)).not.toThrow();
    expect(deserializeFedosDeliveryObservation(record)).toBeNull();
  });

  it("8. deserialize never throws on malformed/non-object input", () => {
    for (const bad of [null, undefined, "string", 42, [], {}]) {
      expect(() => deserializeFedosDeliveryObservation(bad)).not.toThrow();
      expect(deserializeFedosDeliveryObservation(bad)).toBeNull();
    }
  });
});
