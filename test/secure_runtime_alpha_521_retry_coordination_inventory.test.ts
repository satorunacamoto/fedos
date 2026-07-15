import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_521_retry_coordination_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/board/outbox/fedos_publish_scheduler.ts?raw";

describe("Secure Runtime Alpha 521 -- Retry Coordination Inventory", () => {
  it("re-confirms the exact, unchanged shape of #attemptIntent()'s own observations array", () => {
    expect(schedulerSource).toContain('this.#observe(intent.id, "abandoned", result.reason)');
    expect(schedulerSource).toContain('const observations: FedosBoardOutboxObservation[] = [this.#observe(intent.id, "attempt-started")];');
  });

  it("cross-references the Alpha 514 discovered-consequence finding", () => {
    expect(doc).toContain("secure_runtime_alpha_514_failure_path_verification");
    expect(doc).toMatch(/invalid-transition/);
  });
});
