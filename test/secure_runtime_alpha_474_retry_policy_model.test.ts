import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_474_retry_policy_model.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import publisherSource from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/os/messenger/board/outbox/fedos_publish_scheduler.ts?raw";

/**
 * Secure Runtime Alpha 474 -- "Retry Policy Model": Stage 4 of the
 * Alpha 471-480 Canonical Publish Scheduler Foundation Arc.
 */
describe("Secure Runtime Alpha 474 -- Retry Policy Model", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc rejects exponential backoff outright", () => {
    expect(designDocSource).toMatch(/REJECTED outright — this Arc's own instruction explicitly\s*\n\s*prohibits it/);
  });

  it("3. the design doc rejects a numeric retry-delay field", () => {
    expect(designDocSource).toMatch(/REJECTED: a numeric delay is still a scheduling policy/);
  });

  it("4. the design doc adopts the closed three-value enum", () => {
    expect(designDocSource).toMatch(/ADOPTED — matches this/);
    expect(designDocSource).toMatch(/Arc's own required constraint exactly/);
  });

  it('5. structural: FedosBoardOutboxRetryPolicy is exactly "immediate" | "later" | "never"', () => {
    expect(publisherSource).toMatch(
      /export type FedosBoardOutboxRetryPolicy = "immediate" \| "later" \| "never";/,
    );
  });

  it("6. structural: no backoff duration field, delay computation, or Math.pow anywhere in the Publisher or Scheduler source", () => {
    expect(publisherSource).not.toMatch(/backoffMs|delayMs|retryAfter|Math\.pow|Math\.exp/i);
    expect(schedulerSource).not.toMatch(/backoffMs|delayMs|retryAfter|Math\.pow|Math\.exp/i);
  });

  it("7. the design doc records the immediate-downgrade termination guardrail", () => {
    expect(designDocSource).toMatch(/downgrades it to `"later"` before acting/);
  });
});
