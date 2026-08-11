import { describe, it, expect } from "vitest";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import type { FedosPersistedDeliveryObservationRecordV1 } from "../src/os/messenger/board/observation/fedos_delivery_observation_codec.js";

/**
 * Secure Runtime Alpha 465 -- "In-Memory Delivery Observation Persistence
 * Backend": Stage 5 of the Alpha 461-470 Canonical Delivery Observation
 * Arc.
 */
describe("Secure Runtime Alpha 465 -- In-Memory Delivery Observation Persistence Backend", () => {
  const record: FedosPersistedDeliveryObservationRecordV1 = {
    schemaVersion: 1,
    id: "s::queued::1",
    subjectId: "s",
    state: "queued",
    observedAt: 1,
  };

  it("1. putObservation inserts a genuinely new record", () => {
    const persistence = new InMemoryFedosDeliveryObservationPersistence();
    expect(persistence.putObservation(record)).toBe("inserted");
    expect(persistence.getObservation(record.id)).toEqual(record);
  });

  it("2. putObservation with the same id and identical content is already-present", () => {
    const persistence = new InMemoryFedosDeliveryObservationPersistence();
    persistence.putObservation(record);
    expect(persistence.putObservation({ ...record })).toBe("already-present");
  });

  it("3. putObservation with the same id and different content is a conflict, original preserved", () => {
    const persistence = new InMemoryFedosDeliveryObservationPersistence();
    persistence.putObservation(record);
    const clashing = { ...record, state: "failed" as const };
    expect(persistence.putObservation(clashing)).toBe("conflict");
    expect(persistence.getObservation(record.id)).toEqual(record);
  });

  it("4. getObservation returns null for an unknown id", () => {
    const persistence = new InMemoryFedosDeliveryObservationPersistence();
    expect(persistence.getObservation("nope")).toBeNull();
  });

  it("5. listObservations returns a fresh array every call -- caller mutation cannot affect internal state", () => {
    const persistence = new InMemoryFedosDeliveryObservationPersistence();
    persistence.putObservation(record);
    const first = persistence.listObservations() as FedosPersistedDeliveryObservationRecordV1[];
    first.push({ ...record, id: "extra", observedAt: 2 });
    expect(persistence.listObservations()).toHaveLength(1);
  });

  it("6. independent instances never share state", () => {
    const a = new InMemoryFedosDeliveryObservationPersistence();
    const b = new InMemoryFedosDeliveryObservationPersistence();
    a.putObservation(record);
    expect(b.listObservations()).toHaveLength(0);
  });
});
