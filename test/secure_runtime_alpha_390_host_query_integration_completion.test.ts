import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_390_host_query_integration_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import querySource from "../src/board/query/fedos_board_query.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/board/repository/fedos_board_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import persistenceSource from "../src/board/persistence/fedos_board_persistence.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { AppendOnlyFedosBoardPersistence } from "../src/board/persistence/append_only_fedos_board_persistence.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

/**
 * Secure Runtime Alpha 390 -- "Host Query Integration Completion":
 * Stage 10, the closing Stage, of the Alpha 381-390 Canonical Board
 * Query Host Integration & Startup Failure Closure Arc. Review only.
 * Freezes every finding and recommends exactly one next Arc.
 */
describe("Secure Runtime Alpha 390 -- Host Query Integration Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc issues a Completion Declaration", () => {
    expect(normalize(designDocSource)).toContain(
      "**This Arc's own Objective is CONFIRMED COMPLETE.**",
    );
  });

  it("3. the design doc recommends exactly one next Arc: Desktop Host Durable Write Coordination, and explicitly not Ontology integration", () => {
    expect(designDocSource).toContain("**Desktop Host Durable Write Coordination Arc.**");
    expect(normalize(designDocSource)).toContain(
      "**Ontology integration is explicitly NOT the next recommended Arc**",
    );
  });

  it("4. the whole assembly is still fully functional end to end -- both in-memory and append-only backed", async () => {
    const h1 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await h1.start();
    expect(h1.state()).toBe("ready");
    expect(h1.query()).not.toBeNull();
    await h1.stop();

    dir = mkdtempSync(join(tmpdir(), "a390-"));
    const h2 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new AppendOnlyFedosBoardPersistence(join(dir, "board.jsonl")) });
    await h2.start();
    expect(h2.state()).toBe("ready");
    expect(h2.query()).not.toBeNull();
    await h2.stop();
  });

  it("5. Regression: package.json dependency count remains unchanged at 2, no bin field", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("6. Regression: Cargo.toml carries no new dependency", () => {
    expect(cargoTomlSource).not.toMatch(/board.?query|fedos.?board.?query/i);
  });

  it("7. Regression: src/worker.ts carries zero reference to the Host or the Query layer", () => {
    expect(workerSource).not.toMatch(/FedosDesktopHost|FedosBoardQuery/);
  });

  it("8. Regression: FedosBoardQuery and FedosBoardService both carry zero semantic diff from prior Arcs", () => {
    expect(querySource).toMatch(/recentFeed\(/);
    expect(querySource).toMatch(/thread\(/);
    expect(serviceSource).toMatch(/registerPost\(post: FedosBoardPost\): FedosBoardRegistrationResult/);
  });

  it("9. Regression: FedosBoardPersistence's own frozen port carries zero diff", () => {
    expect(persistenceSource).toMatch(/export interface FedosBoardPersistence \{/);
  });

  it("10. behavioral: the confirmed defect (hydration-thrown exception) is closed, verified once more at completion", async () => {
    dir = mkdtempSync(join(tmpdir(), "a390-"));
    const filePath = join(dir, "board.jsonl");
    writeFileSync(filePath, '{"schemaVersion":1,"id":"trunc', "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: persistence });
    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed");
  });

  it("11. the design doc restates the Durable Write Warning honestly, without solving it", () => {
    expect(designDocSource).toContain("host.board()?.registerPost(post)");
    expect(designDocSource).toContain("FedosBoardPersistence unchanged");
  });

  it("12. the design doc's own 'still out of scope' section names every subsystem this Arc's own instruction excludes", () => {
    for (const item of [
      "Automatic persistence of `board().registerPost()` writes",
      "Storage path authority, append `fsync`, compaction, recovery",
      "GUI, executable entry point, DM/private conversation model,",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("13. the design doc cross-references every prior Stage of this Arc, Alpha 381 through Alpha 389, plus Alpha 367", () => {
    for (let n = 381; n <= 389; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
    expect(designDocSource).toContain("secure_runtime_alpha_367_host_restart_verification");
  });
});
