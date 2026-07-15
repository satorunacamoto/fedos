import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_503_default_publisher_and_observation_repository_decision.md?raw";

describe("Secure Runtime Alpha 503 -- Default Publisher and Observation Repository Decision", () => {
  it("adopts MockFedosBoardOutboxPublisher as the default publisher", () => {
    expect(doc).toMatch(/ADOPTED\. It already exists/);
    expect(doc).toContain("MockFedosBoardOutboxPublisher");
  });

  it("adopts an in-memory-backed FedosDeliveryObservationRepository as the default", () => {
    expect(doc).toContain(
      "new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence())",
    );
  });

  it("rejects auto-constructing a real Nostr adapter as the default", () => {
    expect(doc).toMatch(/REJECTED: requires a live `FedosRelay` connection/);
  });

  it("states the safety consequence: no real network delivery happens by accident", () => {
    expect(doc).toMatch(/no network\s+call, no real transport, ever/);
  });
});
