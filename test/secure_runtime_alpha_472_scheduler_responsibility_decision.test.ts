import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_472_scheduler_responsibility_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";

/**
 * Secure Runtime Alpha 472 -- "Scheduler Responsibility Decision":
 * Stage 2 of the Alpha 471-480 Canonical Publish Scheduler Foundation
 * Arc. Decision only -- no implementation file this Stage.
 */
describe("Secure Runtime Alpha 472 -- Scheduler Responsibility Decision", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc adopts Option B -- a separate FedosPublishScheduler class", () => {
    expect(designDocSource).toMatch(/\*\*Option B\.\*\*/);
  });

  it("3. the design doc rejects folding scheduler logic into FedosDesktopHost", () => {
    expect(designDocSource).toMatch(/fold Scheduler logic into `FedosDesktopHost`\.\*\* REJECTED/);
  });

  it("4. the design doc rejects the Scheduler also implementing Publisher itself", () => {
    expect(designDocSource).toMatch(/conflates "when to attempt" with "how to deliver"/);
  });

  it("5. the design doc names exactly what the Scheduler owns and does not own", () => {
    expect(designDocSource).toMatch(/It does NOT own/);
    expect(designDocSource).toMatch(/exponential backoff, no scheduled-delay computation, of any kind\./);
  });

  it("6. structural: FedosDesktopHost remains request-driven (submitPost), not a cross-reference to this Arc's own Scheduler", () => {
    expect(hostSource).toMatch(/submitPost\(/);
    expect(hostSource).not.toMatch(/FedosPublishScheduler|Scheduler/);
  });
});
