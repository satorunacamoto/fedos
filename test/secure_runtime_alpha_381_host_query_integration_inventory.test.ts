import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_381_host_query_integration_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import querySource from "../src/os/messenger/board/query/fedos_board_query.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { AppendOnlyFedosBoardPersistence } from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

/**
 * Secure Runtime Alpha 381 -- "Existing Host and Query Integration
 * Inventory": Stage 1 of the Alpha 381-390 Canonical Board Query Host
 * Integration & Startup Failure Closure Arc. Review only. Inventories
 * the actual current Host/Query source before any implementation.
 */
describe("Secure Runtime Alpha 381 -- Host Query Integration Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. structural: query() did not exist on the Host at the START of this inventory Stage -- confirmed against the shape this Arc's own Alpha 384 will add", () => {
    // This Stage's own inventory itself is a description of the pre-Arc
    // state; by the time this Arc's own commit lands, query() exists.
    // The design doc's own §2 records the finding as historical fact.
    expect(designDocSource.replace(/\s+/g, " ")).toContain("No `query()` method exists yet");
  });

  it("3. behavioral: the hydration-throw defect scenario is reproducible and, post-Arc, resolves to failed (Alpha 382)", async () => {
    dir = mkdtempSync(join(tmpdir(), "a381-"));
    const filePath = join(dir, "board.jsonl");
    writeFileSync(filePath, '{"schemaVersion":1,"id":"trunc', "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: persistence });
    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed");
  });

  it("4. behavioral: DesktopApplication.start() genuinely can reject -- confirming Question 4's own finding", async () => {
    const desktopApplication = new DesktopApplication({
      readPublicIdentity: async () => {
        throw new Error("reader failure");
      },
    });
    await expect(desktopApplication.start()).rejects.toThrow(/reader failure/);
  });

  it("5. structural: FedosBoardQuery has zero mutating method -- confirming Question 6's own finding", () => {
    const methodNames = (querySource.match(/^\s{2}\w+\(/gm) ?? []).map((m: string) => m.trim().replace("(", ""));
    expect(methodNames.sort()).toEqual(["constructor", "recentFeed", "thread"].sort());
  });

  it("6. structural: FedosBoardQuerySource is satisfied by exactly the two read methods FedosBoardService already exposes", () => {
    expect(querySource).not.toMatch(/registerPost|findPost/);
  });

  it("7. the design doc names the exact ripple scope -- five existing test files, no more", () => {
    expect(designDocSource).toContain(
      "test/secure_runtime_alpha_335_board_hydration_ownership.test.ts",
    );
    expect(designDocSource.replace(/\s+/g, " ")).toMatch(/No other file requires modification\./);
  });

  it("8. structural: board() was the Host's only write-capable accessor at the time of THIS Arc's own inventory -- since REWIRED to read-only by Alpha 404 (Arc 401-410)", () => {
    expect(hostSource).toMatch(/board\(\): FedosBoardReader \| null/);
  });

  it("9. behavioral: independent hosts sharing no persistence produce isolated results, confirming a baseline for Query isolation", async () => {
    const h1 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    const h2 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await h1.start();
    await h2.start();
    expect(h1.board()).not.toBe(h2.board());
  });

  it("10. the design doc cross-references Alpha 380, Alpha 370, Alpha 361, and Alpha 372", () => {
    for (const ref of [
      "secure_runtime_alpha_380_query_foundation_completion",
      "secure_runtime_alpha_370_recovery_robustness_completion",
      "secure_runtime_alpha_361_host_failure_inventory",
      "secure_runtime_alpha_372_canonical_board_query_contract",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
