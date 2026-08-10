import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_321_board_deployment_runtime_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import tsconfigSource from "../tsconfig.json?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Secure Runtime Alpha 321 -- "Board Deployment and Runtime Inventory":
 * Stage 1 of the Alpha 321-330 Board Durable Backend Selection &
 * Architecture Arc. Review only. Confirms which execution environments
 * are real (Cloudflare Workers, Node), that no browser and no real
 * Desktop shell exist, and that Board has no wiring into any production
 * runtime today.
 */
describe("Secure Runtime Alpha 321 -- Board Deployment and Runtime Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc answers all twelve required inventory questions from its own §3", () => {
    for (let i = 1; i <= 12; i++) {
      expect(designDocSource).toMatch(new RegExp(`### 3\\.${i} `));
    }
  });

  it("3. structural: src/worker.ts carries zero reference to src/board/persistence/", () => {
    expect(workerSource).not.toMatch(
      /src\/board\/persistence\/|FedosBoardPersistence|InMemoryFedosBoardPersistence|PersistedFedosBoardRepository|hydrateFedosBoardService/,
    );
  });

  it("4. structural: DesktopApplication's own doc comment confirms no GUI/Observation implementation exists in that file", () => {
    expect(desktopApplicationSource).toMatch(
      /NO GUI, NO Nostr\/Relay connection, NO Observation implementation/,
    );
    expect(desktopApplicationSource).toMatch(/of any kind exists anywhere in this file\./);
  });

  it("5. structural: tsconfig has no DOM lib and no @types/node -- confirming no browser environment and no typed Node API", () => {
    const tsconfig = JSON.parse(tsconfigSource);
    expect(tsconfig.compilerOptions.lib).not.toContain("DOM");
    expect(tsconfig.compilerOptions.types).not.toContain("node");
  });

  it("6. Regression: package.json dependency count remains unchanged at 2", () => {
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
  });

  it("7. the design doc's own strongest finding: Board has no real caller in any production runtime today", () => {
    expect(designDocSource).toMatch(
      /no real caller of Board persistence exists in any\s*production runtime today/,
    );
  });

  it("8. the design doc confirms no wrangler.toml or deployment manifest exists in this checkout", () => {
    expect(designDocSource).toMatch(/no `wrangler\.toml`/);
  });

  it("9. the design doc cross-references Alpha 320, Alpha 311, and Alpha 301", () => {
    for (const ref of [
      "secure_runtime_alpha_320_board_persistence_completion",
      "secure_runtime_alpha_311_existing_board_persistence_inventory",
      "secure_runtime_alpha_301_existing_board_repository_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
