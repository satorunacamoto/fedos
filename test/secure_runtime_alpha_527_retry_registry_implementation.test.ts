import { describe, it, expect } from "vitest";
import { FedosDeliveryRetryRegistry } from "../src/board/observation/fedos_delivery_retry_registry.js";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";

describe("Secure Runtime Alpha 527 -- Retry Registry Implementation", () => {
  it("starts at 1 and increments by exactly 1 per call for the same subject", () => {
    const registry = new FedosDeliveryRetryRegistry();
    const subject = toFedosDeliveryObservationSubjectId("post-1")!;
    expect(registry.nextAttemptNumber(subject)).toBe(1);
    expect(registry.nextAttemptNumber(subject)).toBe(2);
    expect(registry.nextAttemptNumber(subject)).toBe(3);
  });

  it("tracks independent counters per subject", () => {
    const registry = new FedosDeliveryRetryRegistry();
    const a = toFedosDeliveryObservationSubjectId("post-a")!;
    const b = toFedosDeliveryObservationSubjectId("post-b")!;
    expect(registry.nextAttemptNumber(a)).toBe(1);
    expect(registry.nextAttemptNumber(a)).toBe(2);
    expect(registry.nextAttemptNumber(b)).toBe(1);
  });

  it("currentAttemptCount is a pure read, 0 for an unknown subject, unaffected by reads", () => {
    const registry = new FedosDeliveryRetryRegistry();
    const subject = toFedosDeliveryObservationSubjectId("post-1")!;
    expect(registry.currentAttemptCount(subject)).toBe(0);
    registry.nextAttemptNumber(subject);
    expect(registry.currentAttemptCount(subject)).toBe(1);
    expect(registry.currentAttemptCount(subject)).toBe(1);
  });

  it("independent instances never share state", () => {
    const a = new FedosDeliveryRetryRegistry();
    const b = new FedosDeliveryRetryRegistry();
    const subject = toFedosDeliveryObservationSubjectId("post-1")!;
    a.nextAttemptNumber(subject);
    a.nextAttemptNumber(subject);
    expect(b.currentAttemptCount(subject)).toBe(0);
  });
});
