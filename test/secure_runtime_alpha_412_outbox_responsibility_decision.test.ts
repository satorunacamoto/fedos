import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_412_outbox_responsibility_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardPostSource from "../src/os/messenger/board/fedos_board_post.ts?raw";

/**
 * Secure Runtime Alpha 412 -- "Outbox Responsibility Decision": Stage 2
 * of the Alpha 411-420 Canonical Board Durable Outbox Foundation Arc.
 * Adopts Option B (a separate immutable Outbox intent record).
 */
describe("Secure Runtime Alpha 412 -- Outbox Responsibility Decision", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc adopts Option B and rejects A, C, D, E", () => {
    expect(designDocSource).toMatch(/Option B — adopted/);
    expect(designDocSource).toMatch(/Option A is rejected/);
    expect(designDocSource).toMatch(/Option C is rejected/);
    expect(designDocSource).toMatch(/Option D is rejected/);
    expect(designDocSource).toMatch(/Option E is rejected outright/);
  });

  it("3. the design doc freezes intent/observation/publisher vocabulary", () => {
    expect(designDocSource).toMatch(/\*\*Canonical post\*\*/);
    expect(designDocSource).toMatch(/\*\*Outbox intent\*\*/);
    expect(designDocSource).toMatch(/\*\*Delivery observation\*\*/);
    expect(designDocSource).toMatch(/\*\*Publisher\*\*/);
  });

  it("4. structural: FedosBoardPost remains immutable -- every field readonly, no delivery-status field", () => {
    expect(boardPostSource).not.toMatch(/status|delivery|outbox/i);
    const fieldLines = boardPostSource.match(/^\s+readonly \w+/gm) ?? [];
    expect(fieldLines.length).toBeGreaterThan(0);
  });

  it("5. the design doc states no mutable delivery status is ever added to FedosBoardPost", () => {
    expect(designDocSource).toMatch(/No mutable delivery status field is added to `FedosBoardPost`/);
  });
});
