import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_350_backend_reevaluation_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardPersistenceSource from "../src/os/messenger/board/persistence/fedos_board_persistence.ts?raw";

import { createFedosDesktopHost } from "../src/desktop/host/create_fedos_desktop_host.js";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

/**
 * Secure Runtime Alpha 350 -- "Backend Re-evaluation Completion":
 * Stage 10, the closing Stage, of the Alpha 341-350 Board Durable
 * Backend Re-evaluation & Local Backend Selection Arc. Review only.
 * Freezes the Alpha 349 Decision, confirms every prior boundary this
 * Arc reviewed (but did not modify) remains fully functional and
 * untouched, and recommends exactly one next Arc: Append-only
 * Durable Board Backend.
 */
describe("Secure Runtime Alpha 350 -- Backend Re-evaluation Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc issues a Completion Declaration", () => {
    expect(normalize(designDocSource)).toContain(
      "**This Arc's own Objective is CONFIRMED COMPLETE.**",
    );
  });

  it("3. the design doc recommends exactly one next Arc: Append-only Durable Board Backend", () => {
    expect(normalize(designDocSource)).toContain(
      "**Secure Runtime Alpha 351–360: Append-only Durable Board Backend Arc.**",
    );
  });

  it("4. the design doc freezes the migration path diagram: in-memory -> append-only -> SQLite -> future", () => {
    expect(designDocSource).toContain("InMemoryFedosBoardPersistence");
    expect(designDocSource).toContain("Append-only file");
    expect(designDocSource).toContain("SQLite");
    expect(designDocSource).toContain("[future backend]");
  });

  it("5. the design doc names all four remaining unknowns without solving them", () => {
    for (const unknown of [
      "**Trailing partial-write detection**",
      "**Compaction**",
      "**Storage directory location**",
    ]) {
      expect(designDocSource).toContain(unknown);
    }
  });

  it("6. the Host and persistence boundary this Arc reviewed (but did not modify) are still fully functional", async () => {
    const host = createFedosDesktopHost();
    expect(host).toBeInstanceOf(FedosDesktopHost);
    await host.start();
    expect(host.state()).toBe("ready");
    expect(host.board()).not.toBeNull();
    await host.stop();
    expect(host.state()).toBe("stopped");
  });

  it("7. Regression: package.json dependency count remains unchanged at 2, no bin field, across the whole Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("8. Regression: Cargo.toml carries no new dependency -- unchanged from Alpha 331-340", () => {
    expect(cargoTomlSource).not.toMatch(/sqlite/i);
  });

  it("9. Regression: src/worker.ts and src/desktop/host/ import neither reviewed backend", () => {
    expect(workerSource).not.toMatch(/from ["'].*(sqlite|append.?only)/i);
    expect(hostSource).not.toMatch(/from ["'].*(sqlite|append.?only)/i);
  });

  it("10. Regression: the persistence port this Arc reviewed still exports the same frozen symbols", () => {
    expect(boardPersistenceSource).toMatch(/export interface FedosBoardPersistence \{/);
    expect(boardPersistenceSource).toMatch(/export function fedosPersistedBoardPostRecordsAreEqual/);
  });

  it("11. the design doc's own 'still out of scope' section names every subsystem this Arc's own instruction excludes", () => {
    for (const item of [
      "SQLite, append-only backend, filesystem persistence, IndexedDB, D1,",
      "Ontology integration, Relay Pool, GUI, Electron, Tauri",
      "New dependency of any kind",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("12. the design doc cross-references every prior Stage of this Arc, Alpha 341 through Alpha 349, plus Alpha 340", () => {
    for (let n = 341; n <= 349; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
    expect(designDocSource).toContain("secure_runtime_alpha_340_desktop_host_foundation_completion");
  });
});
