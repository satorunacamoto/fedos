import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_415_outbox_state_observation_separation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import persistenceSource from "../src/os/messenger/board/outbox/fedos_board_outbox_persistence.ts?raw";

/**
 * Secure Runtime Alpha 415 -- "Outbox State and Observation
 * Separation": Stage 5 of the Alpha 411-420 Canonical Board Durable
 * Outbox Foundation Arc. Review/decision only -- no observation type or
 * persistence method is introduced this Arc.
 */
describe("Secure Runtime Alpha 415 -- Outbox State and Observation Separation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc adopts Option B and states the permanent intent/observation rule", () => {
    expect(designDocSource).toMatch(/Option B — adopted/);
    expect(designDocSource).toMatch(
      /Intent is an authoritative delivery REQUEST\. Observations are derived\s*\nhistorical FACTS and never rewrite the intent\./,
    );
  });

  it("3. the design doc explicitly decides no observation code is shipped this Arc", () => {
    expect(designDocSource).toMatch(/no observation code is strictly required this Arc/);
  });

  it("4. structural: FedosBoardOutboxPersistence has exactly the three intent methods, no observation method", () => {
    expect(persistenceSource).toMatch(/putIntent\(/);
    expect(persistenceSource).toMatch(/getIntent\(/);
    expect(persistenceSource).toMatch(/listIntents\(/);
    expect(persistenceSource).not.toMatch(/putObservation|listObservations|Observation/);
  });

  it("5. the design doc states no automatic retry policy is introduced", () => {
    expect(designDocSource).toMatch(/No automatic retry policy/);
  });
});
