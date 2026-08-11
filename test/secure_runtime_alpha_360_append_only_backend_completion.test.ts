import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_360_append_only_backend_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hydrationSource from "../src/os/messenger/board/persistence/fedos_board_hydration.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { AppendOnlyFedosBoardPersistence } from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.js";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

/**
 * Secure Runtime Alpha 360 -- "Append-only Backend Completion
 * Declaration": Stage 10, the closing Stage, of the Alpha 351-360
 * Append-only Durable Board Backend Arc. Review only. Freezes the
 * backend, confirms every existing interface is preserved and every
 * excluded subsystem carries zero diff, and names remaining
 * limitations explicitly -- including a reproduced, confirmed gap in
 * FedosDesktopHost.start()'s own error handling.
 */
describe("Secure Runtime Alpha 360 -- Append-only Backend Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc issues a Completion Declaration", () => {
    expect(normalize(designDocSource)).toContain(
      "**This Arc's own Objective is CONFIRMED COMPLETE.**",
    );
  });

  it("3. the design doc recommends exactly one next Arc: Append-only Compaction & Integrity Review", () => {
    expect(normalize(designDocSource)).toContain(
      "**Secure Runtime Alpha 361–370: Append-only Compaction & Integrity Review.**",
    );
  });

  it("4. Regression: package.json dependency count remains unchanged at 2, no bin field, across the whole Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
    expect(pkg.bin).toBeUndefined();
  });

  it("5. Regression: Cargo.toml carries no new dependency", () => {
    expect(cargoTomlSource).not.toMatch(/append.?only|jsonl/i);
  });

  it("6. Regression: src/worker.ts, src/runtime, and src/desktop/host carry zero reference to the new backend", () => {
    expect(workerSource).not.toMatch(/AppendOnlyFedosBoardPersistence/);
    expect(hostSource).not.toMatch(/AppendOnlyFedosBoardPersistence/);
  });

  it("7. Regression: hydrateFedosBoardService remains completely unmodified in shape", () => {
    expect(hydrationSource).toMatch(/export function hydrateFedosBoardService\(persistence: FedosBoardPersistence\): FedosBoardHydrationResult/);
  });

  it("8. FedosDesktopHost.start() rejects on a corrupt append-only log, and state() correctly reports 'failed' -- fixed by Alpha 382 (Arc 381-390)", async () => {
    dir = mkdtempSync(join(tmpdir(), "a360-"));
    const filePath = join(dir, "board.jsonl");
    writeFileSync(filePath, '{"schemaVersion":1,"id":"trunc', "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: persistence });

    await expect(host.start()).rejects.toThrow();
    // At the time this Arc (351-360) shipped, this was a confirmed, disclosed
    // gap -- state() stuck at "starting". Alpha 382 (Arc 381-390) closed it;
    // this test now documents the FIXED behavior, not the original gap.
    expect(host.state()).toBe("failed");
  });

  it("9. the design doc names this exact FedosDesktopHost.start() gap as a remaining limitation, and states this Arc does not fix it", () => {
    expect(normalize(designDocSource)).toContain(
      "**This Arc does NOT fix it**",
    );
    expect(designDocSource).toContain("`host.state()` afterward reads");
  });

  it("10. the design doc's own 'still out of scope' section names every subsystem this Arc's own instruction excludes", () => {
    for (const item of [
      "SQLite, D1, IndexedDB",
      "GUI, Worker changes, Runtime changes, Relay changes, Protocol",
      "New dependency of any kind",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("11. the design doc names all five remaining limitations", () => {
    for (const limitation of [
      "**No `fsync`**",
      "**No compaction**",
      "**No filesystem path resolution, no Host wiring**",
      "**No concurrent-writer support**",
    ]) {
      expect(designDocSource).toContain(limitation);
    }
  });

  it("12. the design doc cross-references every prior Stage of this Arc, Alpha 351 through Alpha 359, plus Alpha 350", () => {
    for (let n = 351; n <= 359; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
    expect(designDocSource).toContain("secure_runtime_alpha_350_backend_reevaluation_completion");
  });
});
