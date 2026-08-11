import { describe, it, expect } from "vitest";
import { fedosPersistedDeliveryObservationRecordsAreEqual } from "../src/os/messenger/board/observation/fedos_delivery_observation_persistence.js";
import type { FedosPersistedDeliveryObservationRecordV1 } from "../src/os/messenger/board/observation/fedos_delivery_observation_codec.js";

/**
 * Secure Runtime Alpha 464 -- "Delivery Observation Persistence Port":
 * Stage 4 of the Alpha 461-470 Canonical Delivery Observation Arc.
 */
describe("Secure Runtime Alpha 464 -- Delivery Observation Persistence Port", () => {
  const base: FedosPersistedDeliveryObservationRecordV1 = {
    schemaVersion: 1,
    id: "s::queued::1",
    subjectId: "s",
    state: "queued",
    observedAt: 1,
  };

  it("1. two structurally identical records are equal", () => {
    expect(fedosPersistedDeliveryObservationRecordsAreEqual(base, { ...base })).toBe(true);
  });

  it("2. a differing subjectId/state/observedAt/reason makes records unequal", () => {
    expect(fedosPersistedDeliveryObservationRecordsAreEqual(base, { ...base, subjectId: "other" })).toBe(false);
    expect(fedosPersistedDeliveryObservationRecordsAreEqual(base, { ...base, state: "failed" })).toBe(false);
    expect(fedosPersistedDeliveryObservationRecordsAreEqual(base, { ...base, observedAt: 2 })).toBe(false);
    expect(fedosPersistedDeliveryObservationRecordsAreEqual(base, { ...base, reason: "x" })).toBe(false);
  });

  it("3. is not a JSON.stringify comparison -- key order never matters", () => {
    const reordered: FedosPersistedDeliveryObservationRecordV1 = {
      observedAt: 1,
      state: "queued",
      subjectId: "s",
      id: "s::queued::1",
      schemaVersion: 1,
    };
    expect(JSON.stringify(base)).not.toBe(JSON.stringify(reordered));
    expect(fedosPersistedDeliveryObservationRecordsAreEqual(base, reordered)).toBe(true);
  });
});
