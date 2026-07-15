import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_504_delivery_controller_design_decision.md?raw";

describe("Secure Runtime Alpha 504 -- Delivery Controller Design Decision", () => {
  it("names the fire-and-forget tick() problem and the decision to drive tick() directly", () => {
    expect(doc).toMatch(/fire-and-forget call with NO/);
    expect(doc).toContain("FedosPublishScheduler.start()`/`stop()` are never called");
  });

  it("describes the three-step shutdown ordering precisely", () => {
    expect(doc).toMatch(/clears the interval FIRST/);
    expect(doc).toMatch(/await`s `#currentTick`/);
  });

  it("describes the reentrancy guard", () => {
    expect(doc).toMatch(/SKIPPED \(not queued, not run\s*\n?\s*concurrently\)/);
  });

  it("states every write traces back to tick()'s own return value", () => {
    expect(doc).toMatch(/never fabricated by\s*\n?\s*this file/);
  });
});
