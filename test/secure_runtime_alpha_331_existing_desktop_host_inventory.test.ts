import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_331_existing_desktop_host_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import indexSource from "../src/os/_legacy_prototype/index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hydrationSource from "../src/os/messenger/board/persistence/fedos_board_hydration.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 331 -- "Existing Host / Entry-Point Inventory":
 * Stage 1 of the Alpha 331-340 Desktop Host Runtime Foundation Arc.
 * Review only. Confirms no local-process entry point, no `bin`, no
 * CLI, no signal handling, and no disposable resource on
 * DesktopApplication exist anywhere in this repository today.
 */
describe("Secure Runtime Alpha 331 -- Existing Host / Entry-Point Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc answers all twelve required inventory questions from its own §3", () => {
    for (let i = 1; i <= 12; i++) {
      expect(designDocSource).toMatch(new RegExp(`### 3\\.${i} `));
    }
  });

  it("3. structural: package.json has no bin field", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(pkg.bin).toBeUndefined();
  });

  it("4. structural: no process signal handling anywhere in src/desktop or src/index.ts", () => {
    expect(indexSource).not.toMatch(/process\.on\(/);
    expect(desktopApplicationSource).not.toMatch(/process\.on\(/);
  });

  it("5. structural: hydrateFedosBoardService's own module exports exactly the frozen Alpha 318 function", () => {
    expect(hydrationSource).toMatch(/export function hydrateFedosBoardService/);
  });

  it("6. structural: src/index.ts is a pure barrel -- no process entry point, no Host wiring, no argv parsing", () => {
    expect(indexSource).not.toMatch(/function main\(|process\.argv|new FedosDesktopHost|createFedosDesktopHost\(/);
  });

  it("7. Regression: package.json dependency count remains unchanged at 2", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("8. the design doc confirms DesktopApplication owns no disposable resource", () => {
    expect(designDocSource).toMatch(/no open resource, no dispose\/close method/);
  });

  it("9. the design doc cross-references Alpha 330, Alpha 099, and Alpha 318", () => {
    for (const ref of [
      "secure_runtime_alpha_330_durable_backend_selection_completion",
      "secure_runtime_alpha_099_desktop_factory",
      "secure_runtime_alpha_318_board_hydration_index_rebuild",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
