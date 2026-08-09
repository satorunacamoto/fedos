import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_475_outbox_observation_realization.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import persistenceSource from "../src/os/messenger/board/outbox/fedos_board_outbox_persistence.ts?raw";
import {
  createFedosBoardOutboxObservation,
  isFedosBoardOutboxObservationKind,
} from "../src/board/outbox/fedos_board_outbox_observation.js";
import type { FedosBoardOutboxId } from "../src/board/outbox/fedos_board_outbox_types.js";

/**
 * Secure Runtime Alpha 475 -- "Outbox Observation Realization": Stage 5
 * of the Alpha 471-480 Canonical Publish Scheduler Foundation Arc.
 */
describe("Secure Runtime Alpha 475 -- Outbox Observation Realization", () => {
  const outboxId = "post-1::nostr::" as FedosBoardOutboxId;

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it('2. the design doc realizes exactly five of Alpha 415\'s six named kinds, omitting "queued"', () => {
    expect(designDocSource).toMatch(/REJECTED: `queued` belongs to the moment an intent is CREATED/);
    expect(designDocSource).toMatch(
      /realize exactly the five kinds `FedosPublishScheduler`[\s\S]*?constructor\.\*\* ADOPTED\./,
    );
  });

  it("3. the design doc records observation persistence as deferred, not implemented", () => {
    expect(designDocSource).toMatch(/REJECTED this Arc\. See §3\./);
  });

  it("4. structural: FedosBoardOutboxPersistence gained no Observation method this Arc", () => {
    expect(persistenceSource).not.toMatch(/Observation/);
  });

  it("5. isFedosBoardOutboxObservationKind accepts exactly the five realized kinds", () => {
    for (const kind of ["attempt-started", "delivered", "rejected", "failed", "abandoned"]) {
      expect(isFedosBoardOutboxObservationKind(kind)).toBe(true);
    }
    expect(isFedosBoardOutboxObservationKind("queued")).toBe(false);
    expect(isFedosBoardOutboxObservationKind("bogus")).toBe(false);
  });

  it("6. createFedosBoardOutboxObservation constructs a frozen, immutable record", () => {
    const observation = createFedosBoardOutboxObservation(outboxId, "delivered", 1_700_000_000)!;
    expect(observation).toEqual({ outboxId, kind: "delivered", observedAt: 1_700_000_000 });
    expect(Object.isFrozen(observation)).toBe(true);
  });

  it("7. createFedosBoardOutboxObservation carries an optional reason", () => {
    const observation = createFedosBoardOutboxObservation(outboxId, "failed", 1_700_000_000, "timeout")!;
    expect(observation.reason).toBe("timeout");
  });

  it("8. createFedosBoardOutboxObservation fails closed to null for malformed input", () => {
    expect(createFedosBoardOutboxObservation("" as FedosBoardOutboxId, "delivered", 1)).toBeNull();
    expect(createFedosBoardOutboxObservation(outboxId, "queued" as never, 1)).toBeNull();
    expect(createFedosBoardOutboxObservation(outboxId, "delivered", -1)).toBeNull();
    expect(createFedosBoardOutboxObservation(outboxId, "delivered", 1.5)).toBeNull();
    expect(createFedosBoardOutboxObservation(outboxId, "delivered", 1, "")).toBeNull();
  });

  it("9. exposes no mutation method or setter anywhere in the module", () => {
    const observation = createFedosBoardOutboxObservation(outboxId, "delivered", 1)!;
    expect(() => {
      (observation as { kind: string }).kind = "failed";
    }).toThrow();
  });
});
