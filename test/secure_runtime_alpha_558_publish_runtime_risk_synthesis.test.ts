import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 558 -- "Cross-Cutting Risk Synthesis": Stage 18
 * of the Alpha 541-560 Publish Runtime Operational Review Arc. Review
 * test only -- re-confirms the ONE premise the entire "zero Active
 * findings" classification rests on (Alpha 541's own inventory
 * finding), immediately before this Arc's own synthesis doc relies on
 * it again.
 */
describe("Secure Runtime Alpha 558 -- Cross-Cutting Risk Synthesis", () => {
  it("1. the premise underpinning 'zero Active findings' still holds: src/worker.ts still constructs no FedosDesktopHost", () => {
    expect(workerSource).not.toMatch(/FedosDesktopHost/);
  });
});
