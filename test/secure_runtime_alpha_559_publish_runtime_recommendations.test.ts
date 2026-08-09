import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/os/messenger/board/outbox/fedos_publish_scheduler.ts?raw";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

/**
 * Secure Runtime Alpha 559 -- "Recommendations for Future Arcs": Stage
 * 19 of the Alpha 541-560 Publish Runtime Operational Review Arc.
 * Review test only -- re-confirms the two premises this Stage's own
 * "fix first" recommendations rest on: no reentrancy guard, no
 * abandonment-after-N-failures policy, exist in the current Scheduler.
 */
describe("Secure Runtime Alpha 559 -- Recommendations for Future Arcs", () => {
  const code = codeOnlyLines(schedulerSource);

  it("1. no reentrancy guard (e.g. a #ticking field) exists in the current Scheduler", () => {
    expect(code).not.toMatch(/#ticking|#inFlight|#currentTick/);
  });

  it("2. no failure-count/attempt-count field exists anywhere in the current Scheduler", () => {
    expect(code).not.toMatch(/#failureCount|#attemptCount|#crashCount|maxRetries|maxAttempts/);
  });
});
