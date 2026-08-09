import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_401_host_write_surface_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/board/repository/fedos_board_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import queryTypesSource from "../src/board/query/fedos_board_query_types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 401 -- "Existing Host Write Surface Inventory":
 * Stage 1 of the Alpha 401-410 Desktop Host Canonical Write Boundary
 * Closure Arc. Review only. Inventories the actual write/read surface
 * before any implementation.
 */
describe("Secure Runtime Alpha 401 -- Host Write Surface Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. structural: exactly two write routes exist -- submitPost() on the Host, registerPost() reachable through board()'s own returned object", () => {
    expect(hostSource).toMatch(/submitPost\(post: FedosBoardPost\)/);
    expect(serviceSource).toMatch(/registerPost\(post: FedosBoardPost\): FedosBoardRegistrationResult/);
  });

  it("3. structural: zero production caller of host.board() anywhere in src/worker.ts", () => {
    expect(workerSource).not.toMatch(/FedosDesktopHost|\.board\(\)/);
  });

  it("4. structural: FedosBoardQuery's own contract has no write method -- confirming board() cannot be replaced by query() alone", () => {
    expect(queryTypesSource).not.toMatch(/register|write|mutate/i);
  });

  it("5. the design doc names the exact two demonstrating test files", () => {
    expect(designDocSource).toContain("test/secure_runtime_alpha_385_board_service_access_review.test.ts");
    expect(designDocSource).toContain("test/secure_runtime_alpha_389_four_protocol_host_query_verification.test.ts");
  });

  it("6. the design doc names the exact hidden-mutation-exposure finding (Question 10)", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "TypeScript's structural typing ERASES NOTHING at runtime.",
    );
  });

  it("7. the design doc concludes closure requires a real wrapper object, not mere type narrowing", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "requires a REAL wrapper object, not a mere type-level narrowing",
    );
  });

  it("8. the design doc confirms board()'s own read capabilities are not redundant with query()", () => {
    expect(designDocSource).toContain("## 6. Whether board() is required for anything Query cannot provide (Question 5)");
    expect(designDocSource).toContain("**Yes**, for exactly two capabilities");
  });

  it("9. the design doc cross-references Alpha 400, Alpha 395, Alpha 385, and Alpha 373", () => {
    for (const ref of [
      "secure_runtime_alpha_400_desktop_host_write_coordination_completion",
      "secure_runtime_alpha_395_host_write_api_implementation",
      "secure_runtime_alpha_385_board_service_access_review",
      "secure_runtime_alpha_373_recent_feed_query",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
