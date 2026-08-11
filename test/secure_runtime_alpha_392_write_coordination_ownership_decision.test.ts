import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_392_write_coordination_ownership_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 392 -- "Write Coordination Ownership Decision":
 * Stage 2 of the Alpha 391-400 Desktop Host Durable Write Coordination
 * Arc. Review only. Adopts Option A -- the Host coordinates writes
 * directly, no new WriteCoordinator class.
 */
describe("Secure Runtime Alpha 392 -- Write Coordination Ownership Decision", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc adopts Option A explicitly", () => {
    expect(designDocSource).toContain("**Option A, adopted.**");
  });

  it("3. the design doc names and evaluates Option B honestly before rejecting it", () => {
    expect(designDocSource).toContain("**Option B — a new `WriteCoordinator` class.**");
    expect(designDocSource).toContain("**Option B** is rejected.");
  });

  it("4. structural: no WriteCoordinator class (or any similarly-named class) exists anywhere in src/", () => {
    expect(hostSource).not.toMatch(/WriteCoordinator|BoardWriteCoordinator/);
  });

  it("5. structural: no new file exists under src/desktop/host/ beyond the pre-existing three", () => {
    // fedos_desktop_host.ts, fedos_desktop_host_state.ts, create_fedos_desktop_host.ts --
    // confirmed by this Stage's own decision (Section 4): submitPost() is
    // added directly to the existing FedosDesktopHost class.
    expect(hostSource).toMatch(/export class FedosDesktopHost \{/);
  });

  it("6. structural: submitPost() (once implemented, Alpha 395) uses only the Host's own already-owned fields, confirmed by this decision's own reasoning", () => {
    const code = codeOnly(hostSource);
    expect(code).toMatch(/#boardPersistence: FedosBoardPersistence/);
    expect(code).toMatch(/#boardService: FedosBoardService \| null/);
  });

  it("7. the design doc references this Arc's own Objective write-path diagram", () => {
    expect(designDocSource).toContain("submitPost()");
    expect(designDocSource).toContain("Query (same Board instance)");
  });

  it("8. the design doc confirms board() is not removed, deprecated, or gated by this decision", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "this Arc does not remove, deprecate, or gate it",
    );
  });

  it("9. the design doc cross-references Alpha 391, Alpha 332, and Alpha 390", () => {
    for (const ref of [
      "secure_runtime_alpha_391_desktop_host_write_coordination_inventory",
      "secure_runtime_alpha_332_desktop_host_responsibility_decision",
      "secure_runtime_alpha_390_host_query_integration_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
